import Phaser from 'phaser';
import dialogue from '../data/dialogue.json';

/** Rolling credits ending on THE END. */
export default class Credits extends Phaser.Scene {
  constructor() {
    super({ key: 'Credits' });
  }

  /** overlay: roll over the scene underneath (the sunrise) instead of a black screen */
  create(data: { overlay?: boolean } = {}): void {
    const overlay = !!data.overlay;
    if (!overlay) this.cameras.main.setBackgroundColor('#0a080a');
    const styles: Record<string, Phaser.Types.GameObjects.Text.TextStyle> = {
      T: { fontFamily: 'Creepster, Georgia, serif', fontSize: '120px', color: '#e0261f' },
      END: { fontFamily: 'Georgia, serif', fontSize: '80px', color: '#ece2d2', fontStyle: 'bold' },
      h: { fontFamily: 'Courier New, monospace', fontSize: '30px', color: '#d9a54e', fontStyle: 'bold' },
      b: { fontFamily: 'Georgia, serif', fontSize: '40px', color: '#ece2d2', align: 'center', wordWrap: { width: 1500 } },
      s: { fontFamily: 'Georgia, serif', fontSize: '30px', color: '#aa9c8c', fontStyle: 'italic' },
    };
    if (overlay) {
      // clear, bright text on top of the dark sunrise
      styles.h = { ...styles.h, color: '#ffd27a' };
      styles.b = { ...styles.b, color: '#ffffff' };
      styles.s = { ...styles.s, color: '#f2ebe4' };
      styles.END = { ...styles.END, color: '#ffffff' };
    }
    const roll = this.add.container(0, 1120);
    let y = 0;
    let endY = 0;
    for (const [kind, val] of dialogue.credits as Array<[string, string | number]>) {
      if (kind === 'gap') {
        y += val as number;
        continue;
      }
      const t = this.add.text(960, y, String(val), styles[kind]).setOrigin(0.5, 0);
      if (overlay) t.setShadow(0, 3, '#000000', 12, true, true);
      roll.add(t);
      if (kind === 'END') endY = y;
      y += t.height + 22;
    }
    if (overlay) {
      roll.setDepth(10);
      // soft dark column behind the text so it stays readable over the bright sun
      const shade = this.add.graphics().setDepth(5).setAlpha(0);
      for (let i = 0; i < 40; i++) {
        const w = 1300 - i * 25;
        shade.fillStyle(0x1a0a12, 0.018);
        shade.fillRect(960 - w / 2, 0, w, 1080);
      }
      this.tweens.add({ targets: shade, alpha: 1, duration: 2000 });
    } else {
      const lines = this.add.graphics();
      lines.fillStyle(0x000000, 0.2);
      for (let ly = 0; ly < 1080; ly += 4) lines.fillRect(0, ly, 1920, 2);
    }

    const target = 540 - endY - 40;
    const duration = (1120 - target) * (overlay ? 16 : 14);
    const tw = this.tweens.add({ targets: roll, y: target, duration, ease: 'Linear', onComplete: () => this.showAgain() });
    this.input.keyboard?.on('keydown-SPACE', () => (tw.timeScale = 4));
    this.input.keyboard?.on('keyup-SPACE', () => (tw.timeScale = 1));
    this.input.on('pointerdown', () => (tw.timeScale = 4));
    this.input.on('pointerup', () => (tw.timeScale = 1));
  }

  private showAgain(): void {
    const b = this.add
      .text(960, 960, '◀◀ PLAY AGAIN', { fontFamily: 'Courier New, monospace', fontSize: '36px', color: '#ffffff', backgroundColor: '#b8231f', padding: { x: 22, y: 10 } })
      .setOrigin(0.5)
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: b, alpha: 1, delay: 1500, duration: 600 });
    b.on('pointerup', () => window.location.reload());
  }
}
