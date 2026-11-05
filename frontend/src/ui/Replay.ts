import Phaser from 'phaser';
import { Board, OPP_HOUSE } from '../logic/congkak';
import { CheatedMove, hitTest } from '../logic/cheats';
import { getSeedColour, seedOffset } from '../scenes/boardScene.helpers';

/**
 * The VHS rewind replay: a slow, top-down replay of the opponent's last turn on
 * the flat board. The cheat is visible here; the player taps it.
 *
 * Resolves with 'caught' (tapped the cheat in time), 'missed' (cheat played and
 * wasn't tapped), or 'clean' (there was nothing to catch). Wrong taps are
 * reported through onWrongTap so the scene can damage the tape.
 */
export type ReplayResult = 'caught' | 'missed' | 'clean';

export interface ReplayMove {
  before: Board;
  hole: number;
  move: CheatedMove;
}

export const REPLAY_ASSETS: Array<[string, string]> = [
  ['board_flat', 'board/congkak_board_flat.png'],
  ['replay_bg_room', 'game/replay_bg_room.jpg'],
  ['replay_bg_outside', 'game/replay_bg_outside.jpg'],
  ['tipu_stamp', 'game/tipu_stamp.png'],
];

// flat board (1100×300 source) drawn at 1.6× centred on (960, 560)
const SCALE = 1.6;
const OX = 960 - 550 * SCALE;
const OY = 560 - 150 * SCALE;
const SRC: Array<[number, number]> = [
  [385, 215], [550, 215], [715, 215], [950, 150],
  [715, 85], [550, 85], [385, 85], [150, 150],
];
const POS = SRC.map(([x, y]) => ({ x: OX + x * SCALE, y: OY + y * SCALE }));
const SLEEVE = { x: 120, y: 120 };

export async function playReplay(
  scene: Phaser.Scene,
  moves: ReplayMove[],
  opts: { background: 'room' | 'outside'; slow: number; onWrongTap: () => void },
): Promise<ReplayResult> {
  const D = 200;
  const layer = scene.add.container(0, 0).setDepth(D);
  const wait = (ms: number) => new Promise<void>((r) => scene.time.delayedCall(ms, r));

  // ---- VHS rewind transition ----
  const tear = scene.add.graphics().setDepth(D + 50);
  const rew = scene.add
    .text(60, 50, '◀◀ REWIND', { fontFamily: 'Courier New, monospace', fontSize: '54px', color: '#ffffff', fontStyle: 'bold' })
    .setDepth(D + 51)
    .setShadow(3, 0, '#ff2a2a', 0, true, true);
  for (let i = 0; i < 10; i++) {
    tear.clear();
    tear.fillStyle(0x000000, 0.25 + i * 0.07).fillRect(0, 0, 1920, 1080);
    for (let k = 0; k < 7; k++) {
      tear.fillStyle(0xffffff, 0.08 + Math.random() * 0.12).fillRect(Math.random() * -200, Math.random() * 1080, 2200, 4 + Math.random() * 18);
    }
    scene.cameras.main.shake(60, 0.004);
    await wait(70);
  }

  // ---- top-down scene ----
  const bg = scene.add.image(960, 540, `replay_bg_${opts.background}`).setDisplaySize(1920, 1080);
  const board = scene.add.image(960, 560, 'board_flat').setScale(SCALE);
  layer.add([bg, board]);
  tear.clear();

  const counts = [...moves[0].before];
  const seeds: Phaser.GameObjects.Image[][] = POS.map(() => []);
  const drawHole = (i: number) => {
    seeds[i].forEach((s) => s.destroy());
    seeds[i] = [];
    for (let k = 0; k < counts[i]; k++) {
      const o = seedOffset(i, k);
      const s = scene.add.image(POS[i].x + o.dx * 1.4, POS[i].y + o.dy * 2.2, 'seed_' + getSeedColour(k + i)).setDisplaySize(48, 48);
      layer.add(s);
      seeds[i].push(s);
    }
  };
  POS.forEach((_, i) => drawHole(i));

  const hand = scene.add.image(0, -400, 'hand_fist_down').setOrigin(0.5, 1.08).setScale(1.15);
  layer.add(hand);
  const grain = scene.add.graphics();
  grain.fillStyle(0x000000, 0.22);
  for (let y = 0; y < 1080; y += 4) grain.fillRect(0, y, 1920, 2);
  layer.add(grain);
  const dark = scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0);
  layer.add(dark);

  rew.setText(`◀◀ REWIND  ×${opts.slow === 3 ? '⅓' : '½'}`);
  const prompt = scene.add
    .text(960, 1000, 'Tap when you see something off!', {
      fontFamily: 'Georgia, serif',
      fontSize: '40px',
      color: '#f6e2b4',
      backgroundColor: '#140c0acc',
      padding: { x: 24, y: 10 },
    })
    .setOrigin(0.5);
  layer.add(prompt);
  scene.tweens.add({ targets: prompt, alpha: 0.55, yoyo: true, repeat: -1, duration: 700 });

  // ---- tap handling ----
  let windowOpen = false;
  let region = { x: 0, y: 0, r: 0 };
  let caught = false;
  let lastWrong = 0;
  const hit = scene.add.zone(960, 540, 1920, 1080).setInteractive();
  layer.add(hit);
  hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (caught) return;
    if (windowOpen && hitTest(p.worldX, p.worldY, region.x, region.y, region.r)) {
      caught = true;
      return;
    }
    if (scene.time.now - lastWrong > 600) {
      lastWrong = scene.time.now;
      opts.onWrongTap();
      const x = scene.add.text(p.worldX, p.worldY, '✕', { fontFamily: 'Arial', fontSize: '60px', color: '#ff4a3a' }).setOrigin(0.5).setDepth(D + 60);
      scene.tweens.add({ targets: x, alpha: 0, y: p.worldY - 40, duration: 600, onComplete: () => x.destroy() });
    }
  });

  const SOW = 230 * opts.slow;
  const arc = (seedKey: string, from: { x: number; y: number }, to: { x: number; y: number }, ms = SOW) => {
    const s = scene.add.image(from.x, from.y, seedKey).setDisplaySize(48, 48);
    layer.add(s);
    layer.bringToTop(hand);
    hand.setTexture('hand_fist_down');
    return new Promise<void>((r) =>
      scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const x = from.x + (to.x - from.x) * t;
          const y = from.y + (to.y - from.y) * t - 90 * Math.sin(Math.PI * t);
          s.setPosition(x, y);
          hand.setPosition(x, y);
        },
        onComplete: () => {
          s.destroy();
          hand.setTexture('hand_open_down');
          r();
        },
      }),
    );
  };
  const openWindow = (x: number, y: number, ms: number) => {
    region = { x, y, r: 150 };
    windowOpen = true;
    scene.registry.set('replayWindow', { ...region, open: true }); // used by automated play-tests
    scene.time.delayedCall(ms, () => {
      windowOpen = false;
      scene.registry.set('replayWindow', null);
    });
  };

  // ---- play each move of the opponent's turn ----
  let hadCheat = false;
  for (const m of moves) {
    const cheat = m.move.cheat;
    let prev = m.hole;
    counts[m.hole] = 0;
    drawHole(m.hole);
    hand.setPosition(POS[m.hole].x, -200).setTexture('hand_open_down');
    await new Promise<void>((r) => scene.tweens.add({ targets: hand, y: POS[m.hole].y, duration: 260 * opts.slow, onComplete: () => r() }));

    for (let i = 0; i < m.move.steps.length && !caught; i++) {
      const st = m.move.steps[i];
      if (st.type === 'keepSowing') {
        await wait(180 * opts.slow);
        counts[st.fromHole] = 0;
        drawHole(st.fromHole);
        prev = st.fromHole;
        continue;
      }
      if (st.type === 'extraTurn') continue;
      const from = st.type === 'tembak' ? st.fromHole : prev;
      if (st.type === 'tembak') {
        counts[st.fromHole] = 0;
        drawHole(st.fromHole);
      }

      if (cheat && cheat.stepIndex === i && cheat.type === 'skipHole') {
        // the hand travels over YOUR hole and keeps the seed
        hadCheat = true;
        openWindow(POS[st.toHole].x, POS[st.toHole].y, SOW * 3 + 900);
        await arcKeep(POS[from], POS[st.toHole]);
        prev = st.toHole;
        continue;
      }

      await arc('seed_' + getSeedColour(st.seedIndex), POS[from], POS[st.toHole]);
      counts[st.toHole]++;
      drawHole(st.toHole);
      if (st.type === 'sow') prev = st.toHole;

      if (cheat && cheat.stepIndex === i && cheat.type === 'extraSeed') {
        hadCheat = true;
        openWindow(POS[st.toHole].x, POS[st.toHole].y, SOW * 3 + 900);
        await arc('seed_red', SLEEVE, POS[st.toHole], SOW * 1.4);
        counts[st.toHole]++;
        drawHole(st.toHole);
      }
    }

    if (cheat && cheat.stepIndex < 0 && !caught) {
      hadCheat = true;
      if (cheat.type === 'lightsOut') {
        await new Promise<void>((r) => scene.tweens.add({ targets: dark, fillAlpha: 0.78, duration: 300 * opts.slow, onComplete: () => r() }));
        openWindow(POS[cheat.hole].x, POS[cheat.hole].y, 1400 * opts.slow + 800);
        const a = cheat.hole;
        const b = cheat.otherHole!;
        await arc('seed_white', POS[a], POS[b], SOW * 1.6);
        await arc('seed_white', POS[b], POS[a], SOW * 1.6);
        [counts[a], counts[b]] = [counts[b], counts[a]];
        drawHole(a);
        drawHole(b);
        layer.bringToTop(dark);
        await new Promise<void>((r) => scene.tweens.add({ targets: dark, fillAlpha: 0, duration: 300 * opts.slow, onComplete: () => r() }));
      } else {
        // steal / houseSkim: pinch a seed from your hole/house into his house
        openWindow(POS[cheat.hole].x, POS[cheat.hole].y, SOW * 3 + 900);
        hand.setTexture('hand_open_down');
        await new Promise<void>((r) =>
          scene.tweens.add({ targets: hand, x: POS[cheat.hole].x, y: POS[cheat.hole].y, duration: 260 * opts.slow, onComplete: () => r() }),
        );
        counts[cheat.hole] = Math.max(0, counts[cheat.hole] - 1);
        drawHole(cheat.hole);
        await arc('seed_black', POS[cheat.hole], POS[OPP_HOUSE], SOW * 1.5);
        counts[OPP_HOUSE]++;
        drawHole(OPP_HOUSE);
      }
    }
    if (caught) break;
    await wait(300);
  }

  // give the player a moment after the last cheat animation
  if (!caught && windowOpen) await wait(900);
  hit.removeAllListeners();

  const result: ReplayResult = caught ? 'caught' : hadCheat ? 'missed' : 'clean';

  if (caught) {
    windowOpen = false;
    const stamp = scene.add.image(region.x, region.y, 'tipu_stamp').setDepth(D + 70).setScale(2.6).setAngle(-18).setAlpha(0);
    scene.tweens.add({ targets: stamp, scale: 1, angle: -8, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    await wait(200);
    scene.cameras.main.shake(260, 0.012);
    await wait(1300);
    scene.tweens.add({ targets: stamp, alpha: 0, duration: 300, onComplete: () => stamp.destroy() });
  }

  // fade back out
  await new Promise<void>((r) => scene.tweens.add({ targets: layer, alpha: 0, duration: 350, onComplete: () => r() }));
  layer.destroy(true);
  tear.destroy();
  rew.destroy();
  return result;

  // seed stays in the fist while the hand passes over a hole
  function arcKeep(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    hand.setTexture('hand_fist_down');
    return new Promise<void>((r) =>
      scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: SOW * 1.5,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          hand.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - 90 * Math.sin(Math.PI * t));
        },
        onComplete: () => {
          // hover, then move on still holding the seed
          scene.tweens.add({ targets: hand, y: to.y - 30, yoyo: true, duration: 300 * opts.slow, onComplete: () => r() });
        },
      }),
    );
  }
}
