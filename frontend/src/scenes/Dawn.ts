import Phaser from 'phaser';
import dialogue from '../data/dialogue.json';
import { StoryBox } from '../ui/StoryBox';
import { VhsFilter } from '../ui/VhsFilter';
import { Sound } from '../audio/Sound';

/** Win ending: sunrise (placeholder until Noelle's painted sunrise is added), then credits. */
export default class Dawn extends Phaser.Scene {
  constructor() {
    super({ key: 'Dawn' });
  }

  preload(): void {
    StoryBox.preload(this);
    // Placeholder sunrise. Replace assets/game/dawn.jpg (1920×1080) with Noelle's painting.
    this.load.image('dawn_art', 'game/dawn.jpg');
  }

  async create(): Promise<void> {
    const key = 'dawn_art';
    const img = this.add.image(960, 540, key).setDisplaySize(1920, 1080);
    this.cameras.main.fadeIn(1500, 255, 240, 220);
    new VhsFilter(this, 0);
    Sound.mood({ crickets: 0.25, hum: 0, heartbeat: 0 });
    Sound.chime();
    this.tweens.add({ targets: img, scale: img.scale * 1.06, duration: 9000, ease: 'Sine.easeOut' });
    const osd = this.add.text(50, 40, '■ STOP', { fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#ffffff', fontStyle: 'bold' });
    this.tweens.add({ targets: osd, alpha: 0, delay: 2500, duration: 800 });
    await new Promise<void>((r) => this.time.delayedCall(1600, r));
    const box = new StoryBox(this);
    await box.say('Mahsuri', dialogue.dawn);
    this.cameras.main.fadeOut(1500);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Credits'));
  }
}
