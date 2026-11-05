import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import BoardScene from './scenes/BoardScene';

/**
 * Entry point. Base resolution 1920×1080, scaled to fit the window (letterboxed).
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [Boot, BoardScene],
};

const game = new Phaser.Game(config);

// ---------------------------------------------------------------------------
// Demo keys: press D then a digit within 1 s to jump to a scene.
//   D1 → round 1 (room, Wan Mahora)   D2 → round 2 (outside, village chief)
// ---------------------------------------------------------------------------
let dPressedAt = -Infinity;
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'd') {
    dPressedAt = performance.now();
    return;
  }
  if (performance.now() - dPressedAt > 1000) return;
  const rounds: Record<string, 1 | 2> = { '1': 1, '2': 2 };
  const round = rounds[key];
  if (!round) return;
  dPressedAt = -Infinity;
  game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
  game.scene.start('BoardScene', { round });
});
