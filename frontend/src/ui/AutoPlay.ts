/**
 * Auto-play: story dialogue moves on by itself once each line has been spoken
 * (or read). Toggle any time with the AUTO button on the text box, the A key,
 * or Settings. Remembered per browser.
 */
const KEY = 'tipu.auto';
type Listener = (on: boolean) => void;

class AutoPlayState {
  private on = false;
  private listeners = new Set<Listener>();

  constructor() {
    try {
      this.on = localStorage.getItem(KEY) === 'on';
    } catch {
      /* ignore */
    }
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() !== 'a' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      this.toggle();
    });
  }

  get enabled(): boolean {
    return this.on;
  }

  set(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    this.listeners.forEach((l) => l(on));
  }

  toggle(): void {
    this.set(!this.on);
  }

  /** Subscribe to changes; returns an unsubscribe function. */
  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const AutoPlay = new AutoPlayState();
