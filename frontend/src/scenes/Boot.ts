import Phaser from 'phaser';

/** Boot scene: hands straight over to round 1 for now. The story flow spec replaces this later. */
export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    this.scene.start('BoardScene', { round: 1 });
  }
}
