import Phaser from 'phaser';

/**
 * Tape health HUD (top-right): VHS cassette with a chapter label, spinning reels,
 * a red health line that shrinks toward the dot, and a ◀◀ REW chip.
 * Lower health = faster reels + harder shake.
 */
export const TAPE_HUD_ASSETS: Array<[string, string]> = [
  ['tape_body', 'game/tape_body.png'],
  ['tape_reel0', 'game/tape_reel0.png'],
  ['tape_reel1', 'game/tape_reel1.png'],
  ['tape_health_track', 'game/tape_health_track.png'],
  ['tape_health_fill', 'game/tape_health_fill.png'],
  ['tape_label_chapter1', 'game/tape_label_chapter1.png'],
  ['tape_label_chapter2', 'game/tape_label_chapter2.png'],
];

const X = 1490;
const Y = 26;
const SCALE = 0.5; // source images are 800 px wide → 400 px on screen
const FILL_LEFT = 27;
const FILL_RIGHT = 741;

export class TapeHud {
  readonly container: Phaser.GameObjects.Container;
  readonly rewChip: Phaser.GameObjects.Text;
  private reels: Phaser.GameObjects.Image[];
  private fill: Phaser.GameObjects.Image;
  private health = 1;
  private rewinds = 3;

  constructor(scene: Phaser.Scene, chapter: 1 | 2) {
    const body = scene.add.image(0, 0, 'tape_body').setOrigin(0);
    this.reels = [
      scene.add.image(179, 224, 'tape_reel0'),
      scene.add.image(619, 231, 'tape_reel1'),
    ];
    const label = scene.add.image(0, 0, `tape_label_chapter${chapter}`).setOrigin(0);
    const track = scene.add.image(0, 0, 'tape_health_track').setOrigin(0);
    this.fill = scene.add.image(0, 0, 'tape_health_fill').setOrigin(0);

    this.container = scene.add
      .container(X, Y, [body, ...this.reels, label, track, this.fill])
      .setScale(SCALE)
      .setDepth(60);

    this.rewChip = scene.add
      .text(X + 14, Y + 6, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#f0decd',
        backgroundColor: '#1a1210',
        padding: { x: 10, y: 3 },
      })
      .setDepth(61);
    this.rewChip.setStroke('#d9a54e', 0);
    this.setRewinds(3);
    this.setHealth(1);

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this));
  }

  /** 0 → 1. The red line shrinks toward the dot on the left. */
  setHealth(h: number): void {
    this.health = Phaser.Math.Clamp(h, 0, 1);
    const w = FILL_LEFT + (FILL_RIGHT - FILL_LEFT) * this.health;
    this.fill.setCrop(0, 0, w, this.fill.height);
  }

  getHealth(): number {
    return this.health;
  }

  setRewinds(n: number): void {
    this.rewinds = n;
    this.rewChip.setText(`◀◀ REW x${n}`);
    this.rewChip.setAlpha(n > 0 ? 1 : 0.45);
  }

  getRewinds(): number {
    return this.rewinds;
  }

  private update(_time: number, delta: number): void {
    const speed = 0.06 + (1 - this.health) * 0.25; // degrees per ms
    this.reels.forEach((r) => (r.angle -= speed * delta));
    const shake = (1 - this.health) * 6;
    this.container.setPosition(X + (Math.random() - 0.5) * shake, Y + (Math.random() - 0.5) * shake);
  }
}
