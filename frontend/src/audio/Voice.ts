/**
 * Voice lines. Clips live in assets/voice/ and are listed in voice/manifest.json
 * (made by `npm run voices`), which maps each line's text to its file. Any line
 * whose text is in the manifest is spoken when it appears on screen; anything
 * else (live Gemini taunts, hints) stays text-only. No manifest = no voices.
 *
 * Plays through plain <audio> elements, respects the Sound on/off setting and
 * has its own volume (Settings → Voices).
 */
import { Sound } from './Sound';

const VOL_KEY = 'tipu.voiceVol';

/** Same normalisation as scripts/make-voices.mjs, so text on screen matches the manifest. */
export function voiceKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

class VoicePlayer {
  private files = new Map<string, string>();
  private cache = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;
  private finish: (() => void) | null = null;
  private queued: { text: string; resolve: () => void } | null = null;
  private vol = 1;

  constructor() {
    try {
      const v = localStorage.getItem(VOL_KEY);
      if (v !== null) this.vol = Math.min(1, Math.max(0, Number(v)));
    } catch {
      /* ignore */
    }
  }

  /** Loads the manifest once at startup and warms up the clips. Safe to call if there are no voices. */
  async load(): Promise<void> {
    try {
      const res = await fetch('voice/manifest.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const manifest = (await res.json()) as Record<string, string>;
      for (const [key, file] of Object.entries(manifest)) this.files.set(key, `voice/${file}`);
      for (const src of this.files.values()) this.clip(src);
    } catch {
      /* no voices, the game still works */
    }
  }

  has(text: string): boolean {
    return this.files.has(voiceKey(text));
  }

  /**
   * Speaks a line. Resolves when it finishes, or at once if there's no clip.
   * interrupt (story scenes, default): the previous line fades out quickly and this one starts.
   * interrupt: false (board game): a line already playing is never cut off. Lines with no clip
   * leave it alone, and a voiced line waits for it to finish (only the newest waiting line is kept).
   */
  speak(text: string, opts: { interrupt?: boolean } = {}): Promise<void> {
    const interrupt = opts.interrupt ?? true;
    const src = this.files.get(voiceKey(text));
    if (!interrupt && this.current) {
      if (!src) return Promise.resolve();
      this.queued?.resolve();
      return new Promise<void>((resolve) => (this.queued = { text, resolve }));
    }
    this.stop();
    if (!src || !Sound.enabled || this.vol <= 0) return Promise.resolve();
    const a = this.clip(src);
    a.currentTime = 0;
    a.volume = this.vol;
    this.current = a;
    return new Promise<void>((resolve) => {
      const done = () => {
        a.removeEventListener('ended', done);
        if (this.finish === done) this.finish = null;
        if (this.current === a) this.current = null;
        resolve();
        // a board line was waiting for this one: play it now
        const next = this.queued;
        this.queued = null;
        if (next && !this.current) void this.speak(next.text).then(next.resolve);
        else next?.resolve();
      };
      this.finish = done;
      a.addEventListener('ended', done);
      a.play().catch(done);
    });
  }

  /** Stops the current line with a very short fade (no click), and drops anything waiting. */
  stop(): void {
    const q = this.queued;
    this.queued = null;
    q?.resolve();
    const a = this.current;
    if (a) {
      this.current = null;
      const start = a.volume;
      let step = 0;
      const fade = window.setInterval(() => {
        step++;
        if (this.current === a) {
          window.clearInterval(fade); // restarted: leave it playing
          return;
        }
        a.volume = Math.max(0, start * (1 - step / 6));
        if (step >= 6) {
          window.clearInterval(fade);
          if (this.current !== a) a.pause(); // unless the same clip was restarted meanwhile
          a.volume = this.current === a ? this.vol : start;
        }
      }, 20);
    }
    this.finish?.();
  }

  get volume(): number {
    return this.vol;
  }

  setVolume(v: number): void {
    this.vol = Math.min(1, Math.max(0, v));
    if (this.current) this.current.volume = this.vol;
    try {
      localStorage.setItem(VOL_KEY, String(this.vol));
    } catch {
      /* ignore */
    }
  }

  private clip(src: string): HTMLAudioElement {
    let a = this.cache.get(src);
    if (!a) {
      a = new Audio(src);
      a.preload = 'auto';
      this.cache.set(src, a);
    }
    return a;
  }
}

export const Voice = new VoicePlayer();
