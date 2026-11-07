import Phaser from 'phaser';

/**
 * Living background details:
 *  - room:    twinkling window sky, ceiling fan that flips to look like it's turning,
 *             wall-clock pendulum swinging
 *  - outside: twinkling night sky
 * The room uses a background with the fan and pendulum painted out, so the
 * animated sprites sit exactly where they were drawn.
 */
export function preloadAmbience(scene: Phaser.Scene): void {
  scene.load.image('bg_room_anim', 'game/room_bg_anim.jpg');
  scene.load.image('room_fan', 'game/room_fan.png');
  scene.load.image('room_pendulum', 'game/room_pendulum.png');
  scene.load.spritesheet('room_sky', 'game/room_sky_sheet.png', { frameWidth: 320, frameHeight: 201 });
  scene.load.image('bg_outside', 'game/outside_bg.jpg');
  scene.load.spritesheet('outside_sky', 'game/outside_sky_sheet.webp', { frameWidth: 1920, frameHeight: 640 });
}

export function addAmbience(scene: Phaser.Scene, background: 'room' | 'outside'): void {
  if (background === 'room') {
    scene.add.image(960, 540, 'bg_room_anim').setDepth(0);

    if (!scene.anims.exists('room_sky_twinkle')) {
      scene.anims.create({ key: 'room_sky_twinkle', frames: scene.anims.generateFrameNumbers('room_sky'), frameRate: 1000 / 450, repeat: -1 });
    }
    scene.add.sprite(800, 340, 'room_sky').setOrigin(0).setDepth(1).play('room_sky_twinkle');

    // Ceiling fan: mirror it back and forth so the blades appear to turn
    const fan = scene.add.image(960.5, 190, 'room_fan').setDepth(2);
    scene.time.addEvent({ delay: 500, loop: true, callback: () => fan.setFlipX(!fan.flipX) });

    // Pendulum: pivot at the top of the rod, gentle tick-tock swing
    const pendulum = scene.add.image(1794, 405, 'room_pendulum').setOrigin(18 / 42, 5 / 90).setDepth(2).setAngle(-7);
    scene.tweens.add({ targets: pendulum, angle: 7, duration: 1000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
  } else {
    scene.add.image(960, 540, 'bg_outside').setDisplaySize(1920, 1080).setDepth(0);
    if (!scene.anims.exists('outside_sky_twinkle')) {
      scene.anims.create({ key: 'outside_sky_twinkle', frames: scene.anims.generateFrameNumbers('outside_sky'), frameRate: 1000 / 450, repeat: -1 });
    }
    scene.add.sprite(0, 0, 'outside_sky').setOrigin(0).setDepth(1).play('outside_sky_twinkle');
  }
}
