import Phaser from 'phaser';
import dialogue from '../data/dialogue.json';
import { VhsFilter } from '../ui/VhsFilter';
import { Sound } from '../audio/Sound';

export interface ChapterCardData {
  chapter: 1 | 2;
  next: string;
  nextData?: object;
}

/** Between-round title card: spinning tape, BAB/CHAPTER, Malay + English title, opponent. */
export default class ChapterCard extends Phaser.Scene {
  constructor() {
    super({ key: 'ChapterCard' });
  }

  preload(): void {
    this.load.spritesheet('tape_spin', 'game/tape_spin_sheet.webp', { frameWidth: 320, frameHeight: 240 });
  }

  create(data: ChapterCardData): void {
    const ch = dialogue.chapters[String(data.chapter) as '1' | '2'];
    this.cameras.main.setBackgroundColor('#09070a');
    const glow = this.add.graphics();
    glow.fillGradientStyle(0x2a0a0c, 0x2a0a0c, 0x09070a, 0x09070a, 0.9, 0.9, 0, 0).fillRect(0, 0, 1920, 1080);
    glow.setAlpha(0.6);

    const osd = { fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#f0f0f0', fontStyle: 'bold' };
    this.add.text(150, 40, '▶ PLAY', osd);
    this.add.text(1870, 40, `TAPE ${data.chapter}`, osd).setOrigin(1, 0);

    if (!this.anims.exists('tape_spin')) {
      this.anims.create({ key: 'tape_spin', frames: this.anims.generateFrameNumbers('tape_spin'), frameRate: 30, repeat: -1 });
    }
    this.add.sprite(960, 330, 'tape_spin').setScale(1.4).play('tape_spin');

    const mk = (y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) =>
      this.add.text(960, y, text, style).setOrigin(0.5).setAlpha(0);
    const items = [
      mk(620, ch.bab, { fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#a89c94', fontStyle: 'bold' }),
      mk(712, ch.title, { fontFamily: 'Georgia, serif', fontSize: '96px', color: '#ece2d2', fontStyle: 'bold' }),
      mk(800, ch.subtitle, { fontFamily: 'Georgia, serif', fontSize: '44px', color: '#d8ccbc' }),
      mk(880, ch.opponent, { fontFamily: 'Courier New, monospace', fontSize: '32px', color: '#b8aaa0' }),
    ];
    items.forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, delay: 300 + i * 250, duration: 500 }));

    // scanlines + grain
    const lines = this.add.graphics().setDepth(10);
    lines.fillStyle(0x000000, 0.18);
    for (let y = 0; y < 1080; y += 4) lines.fillRect(0, y, 1920, 2);

    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(data.next, data.nextData));
    };
    this.cameras.main.fadeIn(400);
    new VhsFilter(this, data.chapter === 2 ? 1 : 0);
    Sound.mood({ crickets: 0, hum: 0.3, heartbeat: 0 });
    Sound.setIntensity(0.15);
    Sound.whirr(0.8);
    this.time.delayedCall(3600, go);
    this.time.delayedCall(800, () => this.input.once('pointerup', go));
  }
}
