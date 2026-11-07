/**
 * All game sound is synthesised with the Web Audio API — no audio files, so
 * nothing to license or download. Starts only after the first click/key
 * (browser rule) and respects the Settings sound toggle.
 *
 * Ambience layers: crickets (night), low room hum, heartbeat (tension).
 * One-shots: seed tick, tape whirr (rewind), stamp thunk (TIPU!), glitch,
 * tape damage, flicker buzz, page turn.
 */
type Layer = 'crickets' | 'hum' | 'heartbeat';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
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
      if (layer) layer.gain.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.6);
    });
  }

  setHeartbeatRate(r: number): void {
    this.heartbeatRate = Math.max(0.5, Math.min(2.2, r));
  }

  private startLayer(l: Layer): { gain: GainNode; stop: () => void } {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master!);
    let stop = () => undefined as void;

    if (l === 'crickets') {
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
    o.connect(g).connect(this.master!);
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
    n.connect(bp).connect(g).connect(this.master!);
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
    o.connect(g).connect(this.master!);
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
    n.connect(lp).connect(g).connect(this.master!);
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
