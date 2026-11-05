import Phaser from 'phaser';

/** Temporary end card until the memories, reveal and curse scenes are built. */
export default class ToBeContinued extends Phaser.Scene {
  constructor() {
    super({ key: 'ToBeContinued' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#09070a');
    this.add.text(960, 470, 'The tape continues...', { fontFamily: 'Georgia, serif', fontSize: '72px', color: '#ece2d2' }).setOrigin(0.5);
    this.add
      .text(960, 570, 'Memories, the reveal and the ending are coming soon.', { fontFamily: 'Georgia, serif', fontSize: '34px', color: '#a89c94' })
      .setOrigin(0.5);
    const again = this.add
      .text(960, 700, '◀◀ PLAY AGAIN', { fontFamily: 'Courier New, monospace', fontSize: '36px', color: '#fff', backgroundColor: '#b8231f', padding: { x: 24, y: 10 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    again.on('pointerup', () => window.location.reload());
  }
}
