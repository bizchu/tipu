import Phaser from 'phaser';
import dialogue from '../data/dialogue.json';
import { VhsFilter } from '../ui/VhsFilter';
import { Sound } from '../audio/Sound';

const GROUND = 820;

/**
 * Win ending: a sunrise gradient with the sun slowly coming up over the kampung
 * hills, light rays, a rooster walking across, and the credits rolling up over it.
 */
export default class Dawn extends Phaser.Scene {
  constructor() {
    super({ key: 'Dawn' });
  }

  preload(): void {
    this.load.image('rooster', 'game/rooster.webp');
  }

  async create(): Promise<void> {
    this.makeSkyTexture();

    this.add.image(960, 540, 'dawn_sky');
    const sun = this.add.circle(1250, GROUND + 160, 120, 0xfff1b8).setDepth(1);
    const halo = this.add.circle(1250, GROUND + 160, 260, 0xffd27a, 0.25).setDepth(1);
    this.tweens.add({ targets: [sun, halo], y: GROUND - 280, duration: 16000, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: halo, scale: 1.12, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });
    this.drawLand();
    this.addSunlight(sun);

    // rooster loops forever: walk in from the left, stop mid-way to crow, walk off right, repeat
    const rooster = this.add.image(-200, GROUND + 14, 'rooster').setOrigin(0.5, 1).setDepth(6).setScale(0.75);
    const bob = this.tweens.add({ targets: rooster, y: GROUND + 4, angle: { from: -3, to: 3 }, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const walk = () => {
      rooster.setPosition(-200, GROUND + 14).setAngle(0).setScale(0.75);
      bob.resume();
      this.tweens.add({
        targets: rooster,
        x: 820,
        duration: 10000,
        ease: 'Linear',
        onComplete: () => {
          bob.pause();
          rooster.setY(GROUND + 14);
          // puff up and tilt back for the crow
          this.tweens.add({ targets: rooster, angle: -10, scaleY: 0.6, duration: 300, yoyo: true, hold: 900, ease: 'Sine.easeOut' });
          Sound.crow();
          this.time.delayedCall(1800, () => {
            bob.resume();
            this.tweens.add({ targets: rooster, x: 2150, duration: 10000, ease: 'Linear', onComplete: () => this.time.delayedCall(2000, walk) });
          });
        },
      });
    };
    walk();

    // old VHS tape look + a warm vintage grade over everything
    // darken + age it: a brownish multiply layer, a heavy black vignette, then the VHS tape look
    this.add.rectangle(960, 540, 1920, 1080, 0x8a7062, 1).setDepth(140).setBlendMode(Phaser.BlendModes.MULTIPLY);
    const vig = this.add.graphics().setDepth(141);
    for (let i = 0; i < 24; i++) {
      vig.lineStyle(70, 0x000000, 0.06 * (1 - i / 24));
      vig.strokeRect(-35 + i * 26, -35 + i * 15, 1990 - i * 52, 1150 - i * 30);
    }
    new VhsFilter(this, 1);
    Sound.mood({ crickets: 0.15, hum: 0, heartbeat: 0 });
    Sound.chime();
    // ending music fades in over the sunrise and carries on under the credits
    Sound.setIntensity(0);
    Sound.music('ending', { vol: 0.6, fade: 4, loop: false });
    this.cameras.main.fadeIn(1500, 0, 0, 0);
    const osd = this.add.text(150, 40, 'PLAY ▶', { fontFamily: 'Courier New, monospace', fontSize: '40px', color: '#ffffff', fontStyle: 'bold' }).setDepth(200).setShadow(3, 3, '#000', 0);
    this.tweens.add({ targets: osd, alpha: 0, delay: 3000, duration: 800 });

    // Mahsuri's last line, written softly into the sky, then the credits roll up over the sunrise
    await new Promise<void>((r) => this.time.delayedCall(2500, r));
    const line = this.add
      .text(960, 300, dialogue.dawn, { fontFamily: 'Georgia, serif', fontSize: '56px', color: '#ffffff', fontStyle: 'italic', align: 'center', wordWrap: { width: 1400 } })
      .setOrigin(0.5)
      .setDepth(210)
      .setAlpha(0)
      .setShadow(0, 4, '#000000', 14, false, true);
    this.tweens.add({ targets: line, alpha: 1, y: 280, duration: 2000, ease: 'Sine.easeOut' });
    await new Promise<void>((r) => this.time.delayedCall(5000, r));
    this.tweens.add({ targets: line, alpha: 0, y: 200, duration: 2000 });
    await new Promise<void>((r) => this.time.delayedCall(1200, r));
    this.scene.launch('Credits', { overlay: true });
  }

  /** Soft glow + slowly turning god-rays that follow the sun up, plus a faint lens flare. */
  private addSunlight(sun: Phaser.GameObjects.Arc): void {
    if (!this.textures.exists('sun_glow')) {
      const c = this.textures.createCanvas('sun_glow', 1024, 1024);
      if (c) {
        const g = c.getContext();
        const grd = g.createRadialGradient(512, 512, 0, 512, 512, 512);
        grd.addColorStop(0, 'rgba(255,240,200,0.9)');
        grd.addColorStop(0.25, 'rgba(255,200,120,0.35)');
        grd.addColorStop(1, 'rgba(255,160,80,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 1024, 1024);
        c.refresh();
      }
    }
    if (!this.textures.exists('sun_rays')) {
      const c = this.textures.createCanvas('sun_rays', 2400, 2400);
      if (c) {
        const g = c.getContext();
        const cx = 1200;
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          const w = 0.05 + (i % 3) * 0.025;
          const grd = g.createRadialGradient(cx, cx, 0, cx, cx, 1200);
          grd.addColorStop(0, 'rgba(255,236,190,0.5)');
          grd.addColorStop(1, 'rgba(255,236,190,0)');
          g.fillStyle = grd;
          g.beginPath();
          g.moveTo(cx, cx);
          g.arc(cx, cx, 1200, a - w, a + w);
          g.closePath();
          g.fill();
        }
        c.refresh();
      }
    }
    const rays = this.add.image(sun.x, sun.y, 'sun_rays').setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
    const glow = this.add.image(sun.x, sun.y, 'sun_glow').setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setAlpha(0.8);
    // light washing over the whole scene (in front of the land, so the sun "shines on" it)
    const wash = this.add.image(sun.x, sun.y, 'sun_glow').setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setScale(3.2).setAlpha(0);
    const flares = [0.35, 0.6, 0.85].map((t, i) =>
      this.add.circle(0, 0, [40, 22, 60][i], 0xffe2b0, 0.12).setDepth(8).setBlendMode(Phaser.BlendModes.ADD).setData('t', t),
    );
    this.tweens.add({ targets: rays, angle: 360, duration: 40000, repeat: -1 });
    this.tweens.add({ targets: rays, alpha: 0.6, yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: wash, alpha: 0.35, duration: 12000, ease: 'Sine.easeIn' });
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      rays.setPosition(sun.x, sun.y);
      glow.setPosition(sun.x, sun.y);
      wash.setPosition(sun.x, sun.y);
      // flare dots sit on the line from the sun through the screen centre
      for (const f of flares) {
        const t = f.getData('t') as number;
        f.setPosition(sun.x + (960 - sun.x) * 2 * t, sun.y + (540 - sun.y) * 2 * t);
      }
    });
  }

  private makeSkyTexture(): void {
    if (this.textures.exists('dawn_sky')) return;
    const c = this.textures.createCanvas('dawn_sky', 1920, 1080);
    if (!c) return;
    const g = c.getContext();
    const grd = g.createLinearGradient(0, 0, 0, GROUND);
    grd.addColorStop(0, '#2b1f4a');
    grd.addColorStop(0.35, '#7a3f6e');
    grd.addColorStop(0.62, '#e0645a');
    grd.addColorStop(0.82, '#f9a54a');
    grd.addColorStop(1, '#ffe08a');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1920, 1080);
    // soft clouds
    for (let i = 0; i < 9; i++) {
      const y = 180 + Math.random() * 380;
      const x = Math.random() * 1920;
      const cg = g.createRadialGradient(x, y, 10, x, y, 260);
      cg.addColorStop(0, 'rgba(255,190,150,0.35)');
      cg.addColorStop(1, 'rgba(255,190,150,0)');
      g.fillStyle = cg;
      g.beginPath();
      g.ellipse(x, y, 320, 60, 0, 0, Math.PI * 2);
      g.fill();
    }
    c.refresh();
  }

  private drawLand(): void {
    const land = this.add.graphics().setDepth(3);
    // far hills
    land.fillStyle(0x6e3550, 1);
    land.beginPath();
    land.moveTo(0, GROUND - 40);
    for (let x = 0; x <= 1920; x += 40) land.lineTo(x, GROUND - 70 - Math.sin(x / 260) * 45 - Math.sin(x / 90) * 10);
    land.lineTo(1920, 1080);
    land.lineTo(0, 1080);
    land.closePath();
    land.fillPath();
    // near ground
    const near = this.add.graphics().setDepth(5);
    near.fillStyle(0x1c0f14, 1);
    near.fillRect(0, GROUND, 1920, 1080 - GROUND);
    // kampung house on stilts
    near.fillRect(1480, GROUND - 170, 260, 120);
    near.fillTriangle(1450, GROUND - 170, 1610, GROUND - 270, 1770, GROUND - 170);
    for (const x of [1495, 1560, 1640, 1720]) near.fillRect(x, GROUND - 50, 12, 50);
    near.fillStyle(0xffc56a, 0.9);
    near.fillRect(1560, GROUND - 140, 44, 50);
    // palms
    near.fillStyle(0x1c0f14, 1);
    for (const [px, h] of [
      [260, 330],
      [380, 260],
      [1860, 300],
    ] as const) {
      near.fillRect(px - 6, GROUND - h, 12, h);
      // drooping fronds: arcs out and down from the crown
      for (const [dir, len, lift] of [
        [-1, 150, 40],
        [-1, 110, 60],
        [-1, 70, 70],
        [1, 150, 40],
        [1, 110, 60],
        [1, 70, 70],
      ] as const) {
        const pts: Phaser.Math.Vector2[] = [];
        for (let t = 0; t <= 1.001; t += 0.1) {
          pts.push(new Phaser.Math.Vector2(px + dir * len * t, GROUND - h - Math.sin(Math.PI * t * 0.8) * lift + t * t * 90));
        }
        for (let i = 0; i < pts.length - 1; i++) {
          near.lineStyle(14 * (1 - i / pts.length) + 3, 0x1c0f14, 1);
          near.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        }
      }
      near.fillCircle(px, GROUND - h, 12);
    }
  }
}
