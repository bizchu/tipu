import Phaser from 'phaser';
import dialogue from '../data/dialogue.json';
import { StoryBox } from '../ui/StoryBox';
import { VhsFilter } from '../ui/VhsFilter';
import { Sound } from '../audio/Sound';
import { HelpButton } from '../ui/HelpButton';

export const TREE_FOCUS = { x: 0.49, y: 0.5 };

/** Builds the dim tree background with tied Mahsuri in front (shared with the curse scene). */
export function addTreeAndMahsuri(scene: Phaser.Scene): { tree: Phaser.GameObjects.Sprite; mahsuri: Phaser.GameObjects.Image } {
  if (!scene.anims.exists('reveal_tree_loop')) {
    scene.anims.create({ key: 'reveal_tree_loop', frames: scene.anims.generateFrameNumbers('reveal_tree'), frameRate: 6, repeat: -1 });
  }
  const s = (1920 / 682) * 1.5;
  const tree = scene.add.sprite(960, 540, 'reveal_tree').setOrigin(TREE_FOCUS.x, TREE_FOCUS.y).setScale(s).setTint(0x8a8a8a).play('reveal_tree_loop');
  const mahsuri = scene.add.image(960, -16, 'mahsuri_tied').setOrigin(0.5, 0).setDepth(5);
  return { tree, mahsuri };
}

export function preloadTree(scene: Phaser.Scene): void {
  scene.load.spritesheet('reveal_tree', 'game/reveal_tree.jpg', { frameWidth: 682, frameHeight: 384 });
  scene.load.image('mahsuri_tied', 'game/mahsuri_tied.webp');
}

/** Zoom into the tree photo → glitch → white flash → "I am Mahsuri." */
export default class Reveal extends Phaser.Scene {
  constructor() {
    super({ key: 'Reveal' });
  }

  preload(): void {
    StoryBox.preload(this);
    preloadTree(this);
  }

  async create(): Promise<void> {
    HelpButton.hide();
    const wait = (ms: number) => new Promise<void>((r) => this.time.delayedCall(ms, r));
    this.cameras.main.fadeIn(400);
    new VhsFilter(this, 1);
    Sound.mood({ crickets: 0, hum: 0.2, heartbeat: 0.5 });
    Sound.setIntensity(0.65);
    Sound.setHeartbeatRate(1.6);
    if (!this.anims.exists('reveal_tree_loop')) {
      this.anims.create({ key: 'reveal_tree_loop', frames: this.anims.generateFrameNumbers('reveal_tree'), frameRate: 6, repeat: -1 });
    }
    const base = 1920 / 682;
    const photo = this.add.sprite(960, 540, 'reveal_tree').setOrigin(TREE_FOCUS.x, TREE_FOCUS.y).setScale(base).play('reveal_tree_loop');
    await wait(900);

    // push into her silhouette, getting darker and glitchier
    const glitch = this.add.graphics().setDepth(50);
    let t = 0;
    const timer = this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        t += 0.033;
        glitch.clear();
        const amt = Math.max(0, (t - 0.55) / 0.45);
        glitch.fillStyle(0x000000, Math.min(0.7, t * 0.7)).fillRect(0, 0, 1920, 1080);
        for (let i = 0; i < 2 + amt * 12; i++) {
          glitch.fillStyle(Math.random() < 0.5 ? 0xff2a2a : 0xffffff, 0.15 + amt * 0.3).fillRect(-50 + Math.random() * 100, Math.random() * 1080, 2100, 3 + Math.random() * 20 * amt);
        }
        if (amt > 0) this.cameras.main.shake(60, 0.002 + amt * 0.01);
      },
    });
    await new Promise<void>((r) => this.tweens.add({ targets: photo, scale: base * 6, duration: 2200, ease: 'Quad.easeIn', onComplete: () => r() }));
    timer.remove();
    glitch.clear();

    // white flash
    Sound.glitch();
    Sound.mood({ heartbeat: 0, hum: 0.12 });
    Sound.setIntensity(0.3);
    const flash = this.add.rectangle(960, 540, 1920, 1080, 0xffffff, 1).setDepth(60);
    photo.destroy();
    const { mahsuri } = addTreeAndMahsuri(this);
    mahsuri.setAlpha(0);
    const box = new StoryBox(this);
    box.setVisible(false);
    await wait(200);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700 });
    this.tweens.add({ targets: mahsuri, alpha: 1, duration: 1400 });

    for (const line of dialogue.reveal) {
      await box.say(line.name, line.text);
    }

    this.cameras.main.fadeOut(500);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Curse'));
  }
}
