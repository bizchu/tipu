import Phaser from 'phaser';
import { Voice } from '../audio/Voice';
import { AutoPlay } from './AutoPlay';

export interface Line {
  name: string;
  text: string;
  pose?: string;
}

/**
 * Full-width story text box (bottom of screen) with a name tag, typewriter
 * text and click / Space / Enter to continue. Text word-wraps to fit and long
 * names shrink to fit the tag.
 */
export class StoryBox {
  private box: Phaser.GameObjects.Image;
  private tag: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private full = '';
  private typing?: Phaser.Time.TimerEvent;
  private resolveNext?: () => void;
  private autoBtn: Phaser.GameObjects.Text;
  private ignoreNextUp = false;
  /** the line currently on screen: finished typing + finished speaking */
  private lineDone: Promise<void> = Promise.resolve();
  private lineId = 0;
  private typedEarly?: () => void;

  static preload(scene: Phaser.Scene): void {
    scene.load.image('textbox_story', 'ui/textbox_story.png');
    scene.load.image('nametag', 'ui/nametag.png');
  }

  constructor(private scene: Phaser.Scene, depth = 50) {
    const w = 1800;
    const h = (210 * w) / 1680;
    const x = 60;
    const y = 1080 - h - 14;
    this.box = scene.add.image(x, y, 'textbox_story').setOrigin(0).setDisplaySize(w, h).setDepth(depth);
    this.tag = scene.add.image(x + 140, y - 33, 'nametag').setOrigin(0).setDisplaySize(330, 66).setDepth(depth + 1);
    this.nameText = scene.add
      .text(x + 140 + 165, y, '', { fontFamily: 'Georgia, serif', fontSize: '30px', color: '#f6e2b4', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    this.body = scene.add
      .text(x + 190, y + h / 2, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '38px',
        color: '#f0e6d4',
        wordWrap: { width: w - 380 },
        lineSpacing: 8,
      })
      .setOrigin(0, 0.5)
      .setDepth(depth + 2);
    this.arrow = scene.add
      .text(x + w - 130, y + h - 56, 'tap or SPACE  ▼', { fontFamily: 'Georgia, serif', fontSize: '24px', color: '#d6aa5a', fontStyle: 'italic' })
      .setOrigin(1, 0)
      .setDepth(depth + 2)
      .setVisible(false);
    scene.tweens.add({ targets: this.arrow, alpha: 0.2, yoyo: true, repeat: -1, duration: 450 });
    // AUTO toggle on the box (also the A key or Settings)
    this.autoBtn = scene.add
      .text(x + w - 130, y + 22, '', { fontFamily: 'Courier New, monospace', fontSize: '24px', fontStyle: 'bold', padding: { x: 10, y: 4 } })
      .setOrigin(1, 0)
      .setDepth(depth + 3)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.ignoreNextUp = true; // don't also skip the line
        AutoPlay.toggle();
      });
    const paint = (on: boolean) => {
      this.autoBtn.setText(on ? 'AUTO ▶ ON' : 'AUTO ▶ OFF').setColor(on ? '#ffe08a' : '#a08a66').setBackgroundColor(on ? '#5a2a14' : '#00000000');
      if (on) this.maybeAuto();
    };
    paint(AutoPlay.enabled);
    const unsub = AutoPlay.onChange(paint);

    const advance = () => this.advance();
    const tapAdvance = () => {
      if (this.ignoreNextUp) {
        this.ignoreNextUp = false;
        return;
      }
      this.advance();
    };
    scene.input.on('pointerup', tapAdvance);
    scene.input.keyboard?.on('keydown-SPACE', advance);
    scene.input.keyboard?.on('keydown-ENTER', advance);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerup', tapAdvance);
      unsub();
      Voice.stop();
    });
  }

  setVisible(v: boolean): this {
    [this.box, this.tag, this.nameText, this.body, this.autoBtn].forEach((o) => o.setVisible(v));
    if (!v) this.arrow.setVisible(false);
    return this;
  }

  /** Shows a line straight away (no typing, no "tap to continue"): for hints that stay up while the player does something. */
  show(name: string, text: string): this {
    this.typing?.remove();
    this.resolveNext = undefined;
    this.lineId++;
    this.setVisible(true);
    this.nameText.setText(name);
    this.nameText.setFontSize(name.length > 12 ? 24 : 30);
    this.full = text;
    this.body.setText(text);
    this.arrow.setVisible(false);
    return this;
  }

  /** Types out one line and resolves when the player clicks to continue. */
  say(name: string, text: string): Promise<void> {
    this.setVisible(true);
    this.nameText.setText(name);
    this.nameText.setFontSize(name.length > 12 ? 24 : 30);
    this.full = text;
    this.body.setText('');
    this.arrow.setVisible(false);
    const spoken = Voice.speak(text); // stops the previous line's voice if it's still going
    let i = 0;
    let typed!: () => void;
    const typedDone = new Promise<void>((r) => (typed = r));
    this.typedEarly = typed;
    this.typing?.remove();
    this.typing = this.scene.time.addEvent({
      delay: 32,
      repeat: text.length - 1,
      callback: () => {
        i++;
        this.body.setText(text.slice(0, i));
        if (i >= text.length) {
          this.arrow.setVisible(true);
          typed();
        }
      },
    });
    // auto-play waits for the voice; lines with no voice get reading time instead
    const id = ++this.lineId;
    const readTime = Voice.has(text) ? 700 : Math.max(1400, text.length * 55);
    this.lineDone = Promise.all([typedDone, spoken]).then(() => new Promise<void>((r) => this.scene.time.delayedCall(readTime, r)));
    const p = new Promise<void>((resolve) => (this.resolveNext = resolve));
    this.maybeAuto(id);
    return p;
  }

  /** In auto-play, move on once the current line has been typed and spoken. */
  private maybeAuto(id = this.lineId): void {
    if (!AutoPlay.enabled || !this.resolveNext) return;
    void this.lineDone.then(() => {
      if (!AutoPlay.enabled || id !== this.lineId || !this.resolveNext || !this.scene.sys.isActive()) return;
      if (this.body.text.length < this.full.length) this.body.setText(this.full);
      this.advance();
    });
  }

  private advance(): void {
    if (!this.resolveNext) return;
    if (this.body.text.length < this.full.length) {
      this.typing?.remove();
      this.body.setText(this.full);
      this.arrow.setVisible(true);
      this.typedEarly?.();
      return;
    }
    const r = this.resolveNext;
    this.resolveNext = undefined;
    r();
  }
}
