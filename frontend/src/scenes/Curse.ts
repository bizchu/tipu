import Phaser from 'phaser';
import dialogue from '../data/dialogue.json';
import { StoryBox } from '../ui/StoryBox';
import { VhsFilter } from '../ui/VhsFilter';
import { Sound } from '../audio/Sound';
import { addTreeAndMahsuri, preloadTree } from './Reveal';

// top-left → bottom-right, but kept clear of Mahsuri's face in the middle
const POS = [
  { x: 330, y: 240, r: -5 },
  { x: 560, y: 520, r: 3 },
  { x: 1360, y: 300, r: -3 },
  { x: 1590, y: 580, r: 4 },
];
const SCALE = 0.55;

/** Four photos of the curse pop in; then the player taps each one to read what happened. */
export default class Curse extends Phaser.Scene {
  constructor() {
    super({ key: 'Curse' });
  }

  preload(): void {
    StoryBox.preload(this);
    preloadTree(this);
    for (const c of dialogue.curse) this.load.image(`curse_${c.card}`, `game/curse_${c.card}.webp`);
  }

  async create(): Promise<void> {
    this.cameras.main.fadeIn(400);
    addTreeAndMahsuri(this);
    new VhsFilter(this, 1);
    Sound.mood({ crickets: 0, hum: 0.15, heartbeat: 0 });
    const dim = this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0).setDepth(8);
    this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 600 });
    const box = new StoryBox(this);
    const wait = (ms: number) => new Promise<void>((r) => this.time.delayedCall(ms, r));
    await wait(700);

    const cards: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < dialogue.curse.length; i++) {
      const c = dialogue.curse[i];
      const p = POS[i];
      const img = this.add.image(p.x, p.y, `curse_${c.card}`).setDepth(10 + i).setScale(0.1).setAngle(p.r - 12).setAlpha(0);
      cards.push(img);
      box.setVisible(false);
      await new Promise<void>((r) =>
        this.tweens.add({ targets: img, scale: SCALE, angle: p.r, alpha: 1, duration: 360, ease: 'Back.easeOut', onComplete: () => r() }),
      );
      for (const line of c.lines) await box.say('Mahsuri', line);
    }

    // tap each photo to remember
    const seen = new Set<number>();
    await box.say('Mahsuri', 'Tap each photo to remember what happened.').then(() => undefined);
    box.setVisible(true);
    const status = (n: number) =>
      n === 0 ? 'Tap each photo to remember what happened.' : n < 4 ? `${4 - n} more ${4 - n === 1 ? 'memory' : 'memories'}...` : dialogue.curseEnd;
    const hint = this.add
      .text(960, 1000, status(0), { fontFamily: 'Georgia, serif', fontSize: '40px', color: '#f6e2b4', backgroundColor: '#140c0add', padding: { x: 24, y: 12 } })
      .setOrigin(0.5)
      .setDepth(60);
    box.setVisible(false);

    cards.forEach((img, i) => {
      const nudge = this.tweens.add({ targets: img, y: img.y - 10, yoyo: true, repeat: -1, duration: 900, delay: i * 150, ease: 'Sine.easeInOut' });
      img.setInteractive({ useHandCursor: true });
      img.on('pointerover', () => img.setScale(SCALE * 1.05));
      img.on('pointerout', () => img.setScale(SCALE));
      img.on('pointerup', () => {
        if (this.children.getByName('zoom')) return;
        nudge.stop();
        seen.add(i);
        const tick = this.add.text(img.x - 220, img.y - 150, '✓', { fontFamily: 'Arial', fontSize: '48px', color: '#ffffff', backgroundColor: '#d8262b', padding: { x: 10, y: 2 } }).setDepth(30);
        tick.setOrigin(0.5);
        Sound.page();
        this.openZoom(i, () => {
          hint.setText(status(seen.size));
          if (seen.size === 4 && !this.children.getByName('continue')) this.showContinue();
        });
      });
    });
  }

  private openZoom(i: number, onClose: () => void): void {
    const c = dialogue.curse[i];
    const z = this.add.container(0, 0).setDepth(100).setName('zoom');
    const bg = this.add.rectangle(960, 540, 1920, 1080, 0x050405, 0.85).setInteractive();
    const img = this.add.image(620, 520, `curse_${c.card}`).setScale(0.3).setAngle(-6);
    const date = this.add.text(1180, 300, c.date, { fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#d8262b', fontStyle: 'bold' });
    const title = this.add.text(1180, 360, c.title, { fontFamily: 'Georgia, serif', fontSize: '58px', color: '#f6e2b4', fontStyle: 'bold', wordWrap: { width: 640 } });
    const body = this.add.text(1180, 470, c.body.join('\n\n'), { fontFamily: 'Georgia, serif', fontSize: '32px', color: '#ddd1bf', wordWrap: { width: 640 }, lineSpacing: 8 });
    const back = this.add
      .text(1180, 860, 'BACK ◀', { fontFamily: 'Courier New, monospace', fontSize: '36px', color: '#d9a54e', backgroundColor: '#140c0a', padding: { x: 18, y: 8 } })
      .setInteractive({ useHandCursor: true });
    z.add([bg, img, date, title, body, back]);
    z.setAlpha(0);
    this.tweens.add({ targets: z, alpha: 1, duration: 200 });
    this.tweens.add({ targets: img, scale: 0.95, angle: -2, duration: 320, ease: 'Back.easeOut' });
    const close = () => {
      z.destroy();
      onClose();
    };
    back.on('pointerup', close);
    bg.on('pointerup', close);
    this.input.keyboard?.once('keydown-ESC', close);
  }

  private showContinue(): void {
    const b = this.add
      .text(1560, 1000, 'CONTINUE ▶', { fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#ffffff', backgroundColor: '#b8231f', padding: { x: 22, y: 10 } })
      .setOrigin(0.5)
      .setDepth(61)
      .setName('continue')
      .setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: b, alpha: 0.6, yoyo: true, repeat: -1, duration: 500 });
    b.on('pointerup', () => {
      this.cameras.main.fadeOut(700, 255, 240, 220);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Dawn'));
    });
  }
}
