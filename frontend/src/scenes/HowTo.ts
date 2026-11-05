import Phaser from 'phaser';
import { HelpButton } from '../ui/HelpButton';

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
    for (let i = 1; i <= SLIDES; i++) this.load.image(`howto_${i}`, `ui/howto/slides/howto_slide_${i}.png`);
    this.load.image('arrow_next', 'ui/howto/slides/ui_arrow_next.png');
    this.load.image('arrow_back', 'ui/howto/slides/ui_arrow_back.png');
  }

  create(data: HowToData): void {
    this.dataIn = data ?? {};
    HelpButton.hide();
    this.index = 0;
    this.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.85).setInteractive();
    this.slide = this.add.image(960, 520, 'howto_1').setDisplaySize(1720, 968);
    this.back = this.add.image(200, 1010, 'arrow_back').setScale(0.7).setInteractive({ useHandCursor: true });
    this.next = this.add.image(1720, 1010, 'arrow_next').setScale(0.7).setInteractive({ useHandCursor: true });
    this.counter = this.add
      .text(960, 1040, '', { fontFamily: 'Courier New, monospace', fontSize: '28px', color: '#d9c7a8' })
      .setOrigin(0.5);
    const close = this.add
      .text(1860, 40, '✕', { fontFamily: 'Arial, sans-serif', fontSize: '54px', color: '#f6e2b4' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.back.on('pointerup', () => this.go(-1));
    this.next.on('pointerup', () => (this.index === SLIDES - 1 ? this.finish() : this.go(1)));
    close.on('pointerup', () => this.finish());
    this.input.keyboard?.on('keydown-RIGHT', () => (this.index === SLIDES - 1 ? this.finish() : this.go(1)));
    this.input.keyboard?.on('keydown-LEFT', () => this.go(-1));
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.render();
  }

  private go(d: number): void {
    this.index = Phaser.Math.Clamp(this.index + d, 0, SLIDES - 1);
    this.render();
  }

  private render(): void {
    this.slide.setTexture(`howto_${this.index + 1}`).setDisplaySize(1720, 968);
    this.back.setVisible(this.index > 0);
    this.counter.setText(this.index === SLIDES - 1 ? 'Click ▶ to start' : `${this.index + 1} / ${SLIDES}`);
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
