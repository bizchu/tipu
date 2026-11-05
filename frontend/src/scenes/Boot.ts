import Phaser from 'phaser';

/** Idle boot scene; the 3D title screen (outside Phaser) starts the flow. */
export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }
}
