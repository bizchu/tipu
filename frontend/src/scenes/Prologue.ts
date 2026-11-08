import Phaser from 'phaser';
import dialogue from '../data/dialogue.json';
import { StoryBox } from '../ui/StoryBox';
import { VhsFilter } from '../ui/VhsFilter';
import { Sound } from '../audio/Sound';
import { addAmbience, preloadAmbience } from '../ui/Ambience';
import { HelpButton } from '../ui/HelpButton';

/** Mahsuri wakes up with no memory; Wan Mahora invites her to play. */
export default class Prologue extends Phaser.Scene {
  constructor() {
    super({ key: 'Prologue' });
  }

  preload(): void {
    preloadAmbience(this);
    StoryBox.preload(this);
    for (const p of ['confused', 'normal', 'scared']) this.load.image(`mahsuri_${p}`, `game/mahsuri_${p}.png`);
    this.load.image('wan_mahora_calm', 'game/wan_mahora_calm.png');
    this.load.image('board_angled', 'board/congkak_board.png');
  }

  async create(): Promise<void> {
    HelpButton.hide(); // the story box covers the bottom-left; ? returns in gameplay
    addAmbience(this, 'room');
    new VhsFilter(this, 0, 85);
    Sound.mood({ crickets: 0.5, hum: 0.2, heartbeat: 0 });
    Sound.setIntensity(0.1);
    const mahsuri = this.add.image(960, 1080, 'mahsuri_confused').setOrigin(0.5, 1).setDepth(5);
    const wan = this.add.image(960, 1000, 'wan_mahora_calm').setOrigin(0.5, 1).setDepth(5).setAlpha(0);
    const board = this.add.image(960, 1050, 'board_angled').setOrigin(0.5, 1).setDisplaySize(1000, 152).setDepth(6).setAlpha(0);

    // Waking up: blurred room, eyes blinking open
    // soft 'blurry vision' veil instead of a full-screen blur shader (cheap on every GPU)
    const veil = this.add.rectangle(960, 540, 1920, 1080, 0x0a0608, 0.75).setDepth(80);
    const lidTop = this.add.rectangle(960, 0, 1920, 540, 0x000000).setOrigin(0.5, 0).setDepth(90);
    const lidBot = this.add.rectangle(960, 1080, 1920, 540, 0x000000).setOrigin(0.5, 1).setDepth(90);
    const osd = this.add
      .text(150, 40, '▶ PLAY', { fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#ffffff', fontStyle: 'bold' })
      .setDepth(95);
    this.tweens.add({ targets: osd, alpha: 0, delay: 1600, duration: 600 });

    const open = (amount: number, ms: number) =>
      new Promise<void>((r) =>
        this.tweens.add({ targets: [lidTop, lidBot], scaleY: 1 - amount, duration: ms, ease: 'Sine.easeInOut', onComplete: () => r() }),
      );
    await this.wait(600);
    await open(0.3, 500);
    await open(0.05, 250);
    await this.wait(300);
    await open(0.6, 600);
    await open(1, 700);
    this.tweens.add({ targets: veil, alpha: 0, duration: 1400 });

    const box = new StoryBox(this);
    for (const line of dialogue.prologue) {
      if (line.pose.startsWith('mahsuri')) {
        mahsuri.setTexture('mahsuri_' + line.pose.split(':')[1]);
      } else if (wan.alpha === 0) {
        box.setVisible(false);
        this.tweens.add({ targets: mahsuri, alpha: 0, duration: 500 });
        this.tweens.add({ targets: [wan, board], alpha: 1, duration: 700 });
        await this.wait(800);
      }
      await box.say(line.name, line.text);
    }

    this.cameras.main.fadeOut(500);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('HowTo', { next: 'BoardScene', nextData: { round: 1 }, firstTime: true });
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }
}
