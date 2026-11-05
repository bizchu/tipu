import Phaser from 'phaser';

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
      .text(x + w - 150, y + h - 58, '▼', { fontFamily: 'Georgia, serif', fontSize: '26px', color: '#d6aa5a' })
      .setDepth(depth + 2)
      .setVisible(false);
    scene.tweens.add({ targets: this.arrow, alpha: 0.2, yoyo: true, repeat: -1, duration: 450 });

    const advance = () => this.advance();
    scene.input.on('pointerup', advance);
    scene.input.keyboard?.on('keydown-SPACE', advance);
    scene.input.keyboard?.on('keydown-ENTER', advance);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerup', advance);
    });
  }

  setVisible(v: boolean): this {
    [this.box, this.tag, this.nameText, this.body].forEach((o) => o.setVisible(v));
    if (!v) this.arrow.setVisible(false);
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
    let i = 0;
    this.typing?.remove();
    this.typing = this.scene.time.addEvent({
      delay: 32,
      repeat: text.length - 1,
      callback: () => {
        i++;
        this.body.setText(text.slice(0, i));
        if (i >= text.length) this.arrow.setVisible(true);
      },
    });
    return new Promise((resolve) => (this.resolveNext = resolve));
  }

  private advance(): void {
    if (!this.resolveNext) return;
    if (this.body.text.length < this.full.length) {
      this.typing?.remove();
      this.body.setText(this.full);
      this.arrow.setVisible(true);
      return;
    }
    const r = this.resolveNext;
    this.resolveNext = undefined;
    r();
  }
}
