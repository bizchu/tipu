/**
 * Game sound: Pixabay recordings for the night ambience, horror atmosphere,
 * title music and ending music; everything else (clicks, seeds, rewind,
 * stamp, heartbeat…) is synthesised with the Web Audio API. Starts only after
 * the first click/key (browser rule) and respects the Settings sound toggle.
 *
 * Ambience layers: crickets (night), low room hum, heartbeat (tension).
 * One-shots: seed tick, tape whirr (rewind), stamp thunk (TIPU!), glitch,
 * tape damage, flicker buzz, page turn.
 */
type Layer = 'crickets' | 'hum' | 'heartbeat' | 'tension';
type Sample = 'night' | 'tension' | 'title' | 'ending';
/** Music and ambience recordings (all from Pixabay, see CREDITS.md). Loops were pre-crossfaded so they repeat smoothly. */
const SAMPLE_FILES: Record<Sample, string> = {
  night: 'audio/night.mp3',
  tension: 'audio/tension.mp3',
  title: 'audio/title.mp3',
  ending: 'audio/ending.mp3',
};
/** layers that are driven by a recording, restarted once their file finishes loading */
const LAYER_SAMPLE: Partial<Record<Layer, Sample>> = { crickets: 'night', tension: 'tension' };

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** separate volume buses: background ambience vs sound effects */
  private amb: GainNode | null = null;
  private sfx: GainNode | null = null;
  private layers = new Map<Layer, { gain: GainNode; stop: () => void }>();
  private heartbeatTimer: number | null = null;
  private heartbeatRate = 1;

  get enabled(): boolean {
    try {
      return localStorage.getItem('tipu.sound') !== 'off';
    } catch {
      return true;
    }
  }

  /** Call from any user gesture; safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    this.amb = this.ctx.createGain();
    this.amb.gain.value = this.volume('ambience');
    this.amb.connect(this.master);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = this.volume('sfx');
    this.sfx.connect(this.master);
    this.loadSamples();
  }

  // ---------------------------------------------------------------- recorded samples
  // Optional audio files in assets/audio/. If a file is missing the synthesised
  // version is used instead, so the game always has sound.
  private samples = new Map<Sample, AudioBuffer>();

  private loadSamples(): void {
    const ctx = this.ctx!;
    (Object.keys(SAMPLE_FILES) as Sample[]).forEach((k) => {
      fetch(SAMPLE_FILES[k])
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => {
          this.samples.set(k, buf);
          // swap in the recording for any layer that is already playing
          (Object.keys(LAYER_SAMPLE) as Layer[]).forEach((l) => {
            if (LAYER_SAMPLE[l] === k && this.layers.has(l)) this.restartLayer(l);
          });
          if (this.wantedMusic?.k === k) this.music(k, this.wantedMusic.opts);
        })
        .catch(() => undefined);
    });
  }

  private restartLayer(l: Layer): void {
    const old = this.layers.get(l);
    if (!old) return;
    const level = old.gain.gain.value;
    old.stop();
    old.gain.disconnect();
    this.layers.delete(l);
    const fresh = this.startLayer(l);
    fresh.gain.gain.setTargetAtTime(level, this.ctx!.currentTime, 0.6);
  }

  /** UI button click */
  click(): void {
    this.blip(900, 0.05, 0.12, 'square');
  }

  /** opponent loses their temper: low growl, the tension music swells and a few heartbeats */
  angry(): void {
    this.blip(70, 0.6, 0.3, 'sawtooth');
    this.blip(52, 0.8, 0.25, 'sawtooth');
    this.noiseBurst(0.4, 0.25, 600);
    this.heartbeatBurst(7);
  }

  private loopSource(buf: AudioBuffer): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    // skip the few ms of MP3 encoder padding at each end so the loop has no gap
    src.loopStart = Math.min(0.03, buf.duration / 4);
    src.loopEnd = Math.max(src.loopStart + 0.1, buf.duration - 0.03);
    return src;
  }

  // ---------------------------------------------------------------- music (title + ending)
  private musicStop: ((fade: number) => void) | null = null;
  private wantedMusic: { k: Sample; opts: { vol: number; fade: number; loop: boolean } } | null = null;

  /** Fades a music track in (on the background bus). If audio isn't ready yet it starts as soon as it is. */
  music(k: Sample, opts: { vol: number; fade: number; loop: boolean }): void {
    this.wantedMusic = { k, opts };
    const buf = this.samples.get(k);
    if (!buf || !this.ctx || !this.amb) return;
    this.wantedMusic = null;
    this.musicStop?.(1.5);
    const ctx = this.ctx;
    const src = opts.loop ? this.loopSource(buf) : ctx.createBufferSource();
    if (!opts.loop) src.buffer = buf;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.vol, t + opts.fade);
    if (!opts.loop) {
      // fade out before the track ends on its own
      g.gain.setValueAtTime(opts.vol, t + Math.max(opts.fade, buf.duration - 5));
      g.gain.linearRampToValueAtTime(0, t + buf.duration);
    }
    src.connect(g).connect(this.amb);
    src.start(t);
    const stop = (fade: number) => {
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
      window.setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }, fade * 1000 + 100);
      if (this.musicStop === stop) this.musicStop = null;
    };
    this.musicStop = stop;
  }

  /** Fade the current music out over `fade` seconds. */
  stopMusic(fade = 2): void {
    this.wantedMusic = null;
    this.musicStop?.(fade);
  }

  // ---------------------------------------------------------------- intensity
  private heartbeatBase = 0;

  /**
   * 0 = calm … 1 = terrifying. Slowly swells the horror-atmosphere music that
   * sits under the night ambience (takes a few seconds to rise or fall).
   */
  setIntensity(x: number): void {
    if (!this.ctx) return;
    const v = Math.max(0, Math.min(1, x)) * 0.75;
    let layer = this.layers.get('tension');
    if (!layer && v > 0) layer = this.startLayer('tension');
    layer?.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 2.5);
  }

  /** a few seconds of louder, faster heartbeat, then back to normal */
  heartbeatBurst(seconds: number): void {
    if (!this.ctx) return;
    let layer = this.layers.get('heartbeat');
    if (!layer) layer = this.startLayer('heartbeat');
    const g = layer.gain.gain;
    const now = this.ctx.currentTime;
    const prevRate = this.heartbeatRate;
    this.heartbeatRate = Math.max(prevRate, 1.5);
    g.setTargetAtTime(0.45, now, 0.4);
    g.setTargetAtTime(this.heartbeatBase, now + seconds, 1.5);
    window.setTimeout(() => (this.heartbeatRate = prevRate), seconds * 1000);
  }

  /** saved volume 0–1 for 'ambience' or 'sfx' (default 0.8) */
  volume(bus: 'ambience' | 'sfx'): number {
    try {
      const v = localStorage.getItem(`tipu.vol.${bus}`);
      return v === null ? 0.8 : Math.max(0, Math.min(1, Number(v)));
    } catch {
      return 0.8;
    }
  }

  setVolume(bus: 'ambience' | 'sfx', v: number): void {
    try {
      localStorage.setItem(`tipu.vol.${bus}`, String(v));
    } catch {
      /* storage unavailable */
    }
    const node = bus === 'ambience' ? this.amb : this.sfx;
    if (node && this.ctx) node.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setEnabled(on: boolean): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  // ---------------------------------------------------------------- layers

  /** Fade ambience layers to the given volumes (0 = off). */
  mood(levels: Partial<Record<Layer, number>>): void {
    if (!this.ctx) return;
    (Object.keys(levels) as Layer[]).forEach((l) => {
      const v = levels[l] ?? 0;
      let layer = this.layers.get(l);
      if (!layer && v > 0) layer = this.startLayer(l);
      if (l === 'heartbeat') this.heartbeatBase = v;
      // tension music swells slowly; everything else crossfades in ~2 s
      if (layer) layer.gain.gain.setTargetAtTime(v, this.ctx!.currentTime, l === 'tension' ? 2.5 : 0.6);
    });
  }

  setHeartbeatRate(r: number): void {
    this.heartbeatRate = Math.max(0.5, Math.min(2.2, r));
  }

  private startLayer(l: Layer): { gain: GainNode; stop: () => void } {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.amb!);
    let stop = () => undefined as void;

    if (l === 'tension') {
      // horror atmosphere recording (silent until the file has loaded)
      const buf = this.samples.get('tension');
      if (buf) {
        const src = this.loopSource(buf);
        src.connect(gain);
        src.start();
        stop = () => src.stop();
      }
    }

    if (l === 'crickets' && this.samples.has('night')) {
      // real night-outside recording, looped and kept quiet
      const src = this.loopSource(this.samples.get('night')!);
      const quiet = ctx.createGain();
      quiet.gain.value = 0.5;
      src.connect(quiet).connect(gain);
      src.start();
      stop = () => src.stop();
    } else if (l === 'crickets') {
      // chirps: short bursts of a high sine, amplitude-modulated
      const id = window.setInterval(() => {
        const t = ctx.currentTime;
        const f = 4200 + Math.random() * 900;
        for (let k = 0; k < 3 + Math.floor(Math.random() * 3); k++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = f;
          g.gain.setValueAtTime(0, t + k * 0.06);
          g.gain.linearRampToValueAtTime(0.05, t + k * 0.06 + 0.01);
          g.gain.linearRampToValueAtTime(0, t + k * 0.06 + 0.04);
          o.connect(g).connect(gain);
          o.start(t + k * 0.06);
          o.stop(t + k * 0.06 + 0.05);
        }
      }, 520);
      stop = () => window.clearInterval(id);
    }

    if (l === 'hum') {
      const noise = this.noiseSource(4);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      const o = ctx.createOscillator();
      o.frequency.value = 55;
      const og = ctx.createGain();
      og.gain.value = 0.05;
      noise.connect(lp).connect(gain);
      o.connect(og).connect(gain);
      noise.start();
      o.start();
      stop = () => {
        noise.stop();
        o.stop();
      };
    }

    if (l === 'heartbeat') {
      const beat = () => {
        const t = ctx.currentTime;
        [0, 0.22].forEach((d, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.setValueAtTime(70, t + d);
          o.frequency.exponentialRampToValueAtTime(38, t + d + 0.15);
          g.gain.setValueAtTime(0, t + d);
          g.gain.linearRampToValueAtTime(i === 0 ? 0.6 : 0.4, t + d + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.2);
          o.connect(g).connect(gain);
          o.start(t + d);
          o.stop(t + d + 0.25);
        });
        this.heartbeatTimer = window.setTimeout(beat, 1000 / this.heartbeatRate);
      };
      beat();
      stop = () => {
        if (this.heartbeatTimer) window.clearTimeout(this.heartbeatTimer);
      };
    }

    const layer = { gain, stop };
    this.layers.set(l, layer);
    return layer;
  }

  stopAll(): void {
    this.layers.forEach((l) => {
      l.gain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.3);
    });
  }

  // ---------------------------------------------------------------- one-shots

  tick(): void {
    this.blip(1800 + Math.random() * 600, 0.03, 0.12, 'triangle');
  }

  thunk(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.sfx!);
    o.start(t);
    o.stop(t + 0.4);
    this.noiseBurst(0.12, 0.5, 900);
  }

  whirr(seconds = 1.2): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noiseSource(seconds + 0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.linearRampToValueAtTime(2600, t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.1);
    g.gain.linearRampToValueAtTime(0, t + seconds);
    n.connect(bp).connect(g).connect(this.sfx!);
    n.start(t);
    n.stop(t + seconds + 0.2);
  }

  glitch(): void {
    this.noiseBurst(0.18, 0.35, 3000);
    this.blip(90 + Math.random() * 60, 0.15, 0.25, 'square');
  }

  hurt(): void {
    this.blip(110, 0.25, 0.35, 'sawtooth');
    this.noiseBurst(0.2, 0.3, 1200);
  }

  flicker(): void {
    this.blip(60, 0.3, 0.12, 'sawtooth');
    this.noiseBurst(0.08, 0.2, 5000);
  }

  page(): void {
    this.noiseBurst(0.12, 0.18, 2500);
  }

  chime(): void {
    [523, 659, 784].forEach((f, i) => window.setTimeout(() => this.blip(f, 0.5, 0.12, 'sine'), i * 120));
  }

  /** A synthesised "kuk-kuk-kuk-kuuuk" rooster crow (rising then falling sawtooth). */
  crow(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const notes: [number, number, number][] = [
      [0, 0.12, 620],
      [0.16, 0.12, 700],
      [0.32, 0.12, 760],
      [0.5, 0.9, 900],
    ];
    notes.forEach(([d, dur, f]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 1.5;
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t0 + d);
      o.frequency.linearRampToValueAtTime(f * 1.15, t0 + d + dur * 0.4);
      o.frequency.linearRampToValueAtTime(f * 0.7, t0 + d + dur);
      g.gain.setValueAtTime(0, t0 + d);
      g.gain.linearRampToValueAtTime(0.18, t0 + d + 0.02);
      g.gain.linearRampToValueAtTime(0, t0 + d + dur);
      o.connect(bp).connect(g).connect(this.sfx!);
      o.start(t0 + d);
      o.stop(t0 + d + dur + 0.05);
    });
  }

  // ---------------------------------------------------------------- helpers

  private blip(freq: number, dur: number, vol: number, type: OscillatorType): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfx!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, cutoff: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.noiseSource(dur + 0.05);
    const lp = this.ctx.createBiquadFilter();
    lp.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(lp).connect(g).connect(this.sfx!);
    n.start(t);
    n.stop(t + dur + 0.05);
  }

  private noiseBuf: AudioBuffer | null = null;
  private noiseSource(seconds: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = seconds > 2;
    return s;
  }
}

export const Sound = new SoundEngine();

// unlock on the first gesture anywhere
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => Sound.unlock(), { capture: true }));
// click sound for every on-page button (title menu, ?, ⚙, settings)
window.addEventListener('click', (e) => {
  if ((e.target as HTMLElement | null)?.closest?.('button')) Sound.click();
}, { capture: true });
