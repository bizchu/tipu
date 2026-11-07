import Phaser from 'phaser';

/**
 * Always-on VHS look drawn as overlays (no shader, so it is cheap everywhere):
 * scanlines, moving grain, a dark vignette and random tracking bands.
 * `level` 0 = light (round 1), 1 = heavy (round 2). The red tint only lives in
 * the vignette edges so characters keep their original colours.
 */
export class VhsFilter {
  private grain: Phaser.GameObjects.TileSprite;
  private bands: Phaser.GameObjects.Graphics;

  static preload(scene: Phaser.Scene): void {
    if (scene.textures.exists('vhs_grain')) return;
    const c = scene.textures.createCanvas('vhs_grain', 256, 256);
    if (!c) return;
    const ctx = c.getContext();
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < 0.5 ? 18 : 0;
    }
    ctx.putImageData(img, 0, 0);
    c.refresh();
  }

  constructor(private scene: Phaser.Scene, level: 0 | 1 = 0, depth = 150) {
    VhsFilter.preload(scene);
    const lines = scene.add.graphics().setDepth(depth);
    lines.fillStyle(0x000000, level ? 0.16 : 0.1);
    for (let y = 0; y < 1080; y += 4) lines.fillRect(0, y, 1920, 2);

    this.grain = scene.add.tileSprite(960, 540, 1920, 1080, 'vhs_grain').setDepth(depth).setAlpha(level ? 0.9 : 0.55);

    const vig = scene.add.graphics().setDepth(depth);
    const col = level ? 0x2a0204 : 0x000000;
    for (let i = 0; i < 14; i++) {
      vig.lineStyle(60, col, (level ? 0.07 : 0.045) * (i / 14));
      vig.strokeRect(-30 + i * 22, -30 + i * 12, 1980 - i * 44, 1140 - i * 24);
    }

    this.bands = scene.add.graphics().setDepth(depth);
    const chance = level ? 0.06 : 0.015;
    const update = () => {
      this.grain.tilePositionX = Math.random() * 256;
      this.grain.tilePositionY = Math.random() * 256;
      this.bands.clear();
      if (Math.random() < chance) {
        const n = 1 + Math.floor(Math.random() * (level ? 4 : 2));
        for (let k = 0; k < n; k++) {
          this.bands.fillStyle(0xffffff, 0.05 + Math.random() * 0.08).fillRect(0, Math.random() * 1080, 1920, 3 + Math.random() * 14);
        }
      }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, update);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, update));
  }

  /** A short heavy burst (used on the white flash, tape damage, etc). */
  burst(ms = 250): void {
    const g = this.scene.add.graphics().setDepth(this.bands.depth + 1);
    const ev = this.scene.time.addEvent({
      delay: 40,
      repeat: Math.ceil(ms / 40),
      callback: () => {
        g.clear();
        for (let k = 0; k < 6; k++) g.fillStyle(Math.random() < 0.5 ? 0xff2a2a : 0xffffff, 0.12).fillRect(0, Math.random() * 1080, 1920, 4 + Math.random() * 24);
      },
    });
    this.scene.time.delayedCall(ms + 60, () => {
      ev.remove();
      g.destroy();
    });
  }
}
