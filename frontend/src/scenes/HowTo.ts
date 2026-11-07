import Phaser from 'phaser';
import { HelpButton } from '../ui/HelpButton';
import { Sound } from '../audio/Sound';

export interface HowToData {
  /** Scene to start when finished (used in the main flow). */
  next?: string;
  nextData?: object;
  /** Scene to resume when closed (used by the ? button). */
  returnTo?: string;
  /** Called when closed from the title screen. */
  onClose?: () => void;
}

const SLIDES = 6;

/** How to Play: Noelle's parchment slides with back/next arrows. */
export default class HowTo extends Phaser.Scene {
  private index = 0;
  private slide!: Phaser.GameObjects.Image;
  private back!: Phaser.GameObjects.Image;
  private next!: Phaser.GameObjects.Image;
  private counter!: Phaser.GameObjects.Text;
  private dataIn: HowToData = {};

  constructor() {
    super({ key: 'HowTo' });
  }

  preload(): void {
    for (let i = 1; i <= SLIDES; i++) this.load.image(`howto_${i}`, `game/howto_${i}.jpg`);
    this.load.image('arrow_next', 'ui/howto/slides/ui_arrow_next.png');
    this.load.image('arrow_back', 'ui/howto/slides/ui_arrow_back.png');
  }

  create(data: HowToData): void {
    this.dataIn = data ?? {};
    HelpButton.hide();
    this.index = 0;
    this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.85).setInteractive();
    this.slide = this.add.image(960, 500, 'howto_1').setDisplaySize(1560, 878).setInteractive({ useHandCursor: true });
    this.back = this.add.image(85, 500, 'arrow_back').setScale(0.6).setInteractive({ useHandCursor: true });
    this.next = this.add.image(1835, 500, 'arrow_next').setScale(0.6).setInteractive({ useHandCursor: true });
    this.counter = this.add
      .text(960, 985, '', { fontFamily: 'Courier New, monospace', fontSize: '28px', color: '#d9c7a8' })
      .setOrigin(0.5);
    const tap = this.add
      .text(960, 1040, 'Tap or press Enter to continue  ▶', { fontFamily: 'Georgia, serif', fontSize: '30px', color: '#f6e2b4' })
      .setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.35, yoyo: true, repeat: -1, duration: 700 });
    this.tweens.add({ targets: this.next, x: 1850, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.easeInOut' });
    const close = this.add
      .text(1860, 40, '✕', { fontFamily: 'Arial, sans-serif', fontSize: '54px', color: '#f6e2b4' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.back.on('pointerup', () => this.go(-1));
    const forward = () => (this.index === SLIDES - 1 ? this.finish() : this.go(1));
    this.next.on('pointerup', forward);
    this.slide.on('pointerup', forward);
    this.input.keyboard?.on('keydown-ENTER', forward);
    this.input.keyboard?.on('keydown-SPACE', forward);
    close.on('pointerup', () => this.finish());
    this.input.keyboard?.on('keydown-RIGHT', () => (this.index === SLIDES - 1 ? this.finish() : this.go(1)));
    this.input.keyboard?.on('keydown-LEFT', () => this.go(-1));
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.render();
  }

  private go(d: number): void {
    this.index = Phaser.Math.Clamp(this.index + d, 0, SLIDES - 1);
    Sound.page();
    this.render();
  }

  private render(): void {
    this.slide.setTexture(`howto_${this.index + 1}`).setDisplaySize(1560, 878);
    this.back.setVisible(this.index > 0);
    this.counter.setText(`${this.index + 1} / ${SLIDES}`);
  }

  private finish(): void {
    const { next, nextData, returnTo, onClose } = this.dataIn;
    if (returnTo) {
      HelpButton.show(this.game);
      this.scene.stop();
      this.scene.resume(returnTo);
    } else if (next) {
      this.scene.start(next, nextData);
    } else {
      this.scene.stop();
      onClose?.();
    }
  }
}
