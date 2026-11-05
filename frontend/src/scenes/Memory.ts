import Phaser from 'phaser';
import dialogue from '../data/dialogue.json';
import { StoryBox } from '../ui/StoryBox';
import { HelpButton } from '../ui/HelpButton';

export interface MemoryData {
  set: 1 | 2;
}

const CARD_W = 750;
const CARD_H = 502;
const SCALE = 1.15;
// back-to-front offsets of the pile (front first)
const POS = [
  { x: 940, y: 440, r: -2 },
  { x: 976, y: 414, r: 4 },
  { x: 1012, y: 392, r: -5 },
  { x: 1044, y: 374, r: 3 },
];
const DARK = [1, 0.8, 0.68, 0.58];

/** A pile of dated photo cards; the narrator remembers each one, then it slides to the back. */
export default class Memory extends Phaser.Scene {
  constructor() {
    super({ key: 'Memory' });
  }

  preload(): void {
    StoryBox.preload(this);
    this.load.image('mem1_bg', 'game/mem1_bg.jpg');
    this.load.image('mem2_bg', 'game/mem2_bg.jpg');
    for (const n of ['wedding', 'leaving', 'traveller', 'gossip', 'judgement', 'tree', 'whiteblood']) {
      this.load.spritesheet(`mem_${n}`, `game/mem_${n}.png`, { frameWidth: CARD_W, frameHeight: CARD_H });
    }
  }

  async create(data: MemoryData): Promise<void> {
    HelpButton.hide();
    const set = data?.set === 2 ? 2 : 1;
    const items = set === 1 ? dialogue.memory1 : dialogue.memory2;
    this.add.image(960, 540, set === 1 ? 'mem1_bg' : 'mem2_bg');
    const lines = this.add.graphics().setDepth(90);
    lines.fillStyle(0x000000, 0.15);
    for (let y = 0; y < 1080; y += 4) lines.fillRect(0, y, 1920, 2);
    this.cameras.main.fadeIn(600);

    const cards = items.map((it) => {
      const key = `mem_${it.card}`;
      if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(key), frameRate: 6, repeat: -1 });
      return this.add.sprite(0, 0, key).setScale(SCALE).play(key);
    });
    let order = cards.map((_, i) => i);
    const place = (animate: boolean) =>
      order.forEach((ci, depth) => {
        const p = POS[Math.min(depth, POS.length - 1)];
        const c = cards[ci].setDepth(20 - depth);
        const shade = Math.round(255 * DARK[Math.min(depth, DARK.length - 1)]);
        c.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
        if (animate) this.tweens.add({ targets: c, x: p.x, y: p.y, angle: p.r, duration: 450, ease: 'Sine.easeInOut' });
        else c.setPosition(p.x, p.y).setAngle(p.r);
      });
    place(false);

    const box = new StoryBox(this);
    for (let i = 0; i < items.length; i++) {
      await box.say('???', items[i].text);
      if (i === items.length - 1) break;
      const top = cards[order[0]];
      await new Promise<void>((r) => this.tweens.add({ targets: top, x: 2300, angle: 16, duration: 380, ease: 'Quad.easeIn', onComplete: () => r() }));
      order = [...order.slice(1), order[0]];
      place(true);
      await new Promise<void>((r) => this.time.delayedCall(480, r));
    }

    this.cameras.main.fadeOut(600);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (set === 1) this.scene.start('ChapterCard', { chapter: 2, next: 'BoardScene', nextData: { round: 2 } });
      else this.scene.start('Reveal');
    });
  }
}
