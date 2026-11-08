import Phaser from 'phaser';
import dialogue from '../data/dialogue.json';
import { StoryBox } from '../ui/StoryBox';
import { VhsFilter } from '../ui/VhsFilter';
import { Sound } from '../audio/Sound';
import { HelpButton } from '../ui/HelpButton';
import { addAmbience, preloadAmbience } from '../ui/Ambience';

/** After round 2: the chief's dead stare, glitching between colour and grey, before Memory 2. */
export default class DeadStare extends Phaser.Scene {
  constructor() {
    super({ key: 'DeadStare' });
  }

  preload(): void {
    StoryBox.preload(this);
    preloadAmbience(this);
    this.load.image('chief_dead', 'game/chief_dead.webp');
    this.load.image('chief_dead_grey', 'game/chief_dead_grey.webp');
  }

  async create(): Promise<void> {
    HelpButton.hide();
    const wait = (ms: number) => new Promise<void>((r) => this.time.delayedCall(ms, r));
    addAmbience(this, 'outside');
    this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.55).setDepth(3);
    const vhs = new VhsFilter(this, 1);
    Sound.mood({ crickets: 0, hum: 0.3, heartbeat: 0.45 });
    Sound.setIntensity(0.75);
    Sound.setHeartbeatRate(0.8);
    this.cameras.main.fadeIn(500);

    const face = this.add.image(960, 1080, 'chief_dead').setOrigin(0.5, 1).setDepth(5).setScale(0.9);
    this.tweens.add({ targets: face, scale: 1.08, duration: 7000, ease: 'Sine.easeIn' });

    // glitch between colour and grey at random
    const ev = this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        const grey = Math.random() < 0.35;
        face.setTexture(grey ? 'chief_dead_grey' : 'chief_dead');
        face.x = 960 + (grey ? (Math.random() - 0.5) * 30 : 0);
        if (grey && Math.random() < 0.4) {
          vhs.burst(160);
          Sound.glitch();
        }
      },
    });

    const box = new StoryBox(this);
    for (const line of dialogue.deadStare) await box.say(line.name, line.text);
    ev.remove();
    face.setTexture('chief_dead_grey');
    Sound.glitch();
    vhs.burst(500);
    await wait(500);
    this.cameras.main.fadeOut(400, 255, 255, 255);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Memory', { set: 2 }));
  }
}
