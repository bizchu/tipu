/**
 * Pure, Phaser-free helpers for BoardScene, kept separate so they can be
 * unit-tested in Node without loading Phaser.
 */
import { Board, OPP_HOLES, previewLastSeed } from '../logic/congkak';

// ---------------------------------------------------------------------------
// RoundConfig — passed via scene.start('BoardScene', config)
// ---------------------------------------------------------------------------

export interface RoundConfig {
  /** 1 = room / Wan Mahora, 2 = outside / village chief */
  round: 1 | 2;
  /** Seeds per hole at game start. Falls back to round-derived default if absent/invalid. */
  seedsPerHole?: number;
  /** Background asset key. */
  background?: 'room' | 'outside';
  /** Opponent character. */
  opponent?: 'wan_mahora' | 'village_chief';
}

/** Fully-resolved config with all defaults applied. */
export interface ResolvedConfig {
  round: 1 | 2;
  seedsPerHole: number;
  background: 'room' | 'outside';
  opponent: 'wan_mahora' | 'village_chief';
}

/**
 * Accepts any unknown value and returns a fully-resolved {@link ResolvedConfig}.
 * - round: 1 or 2 only; anything else → 1
 * - background / opponent: kept if valid, else derived from round
 * - seedsPerHole: positive integer kept, else round 1 → 3, round 2 → 4
 */
export function parseRoundConfig(raw: unknown): ResolvedConfig {
  const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const round: 1 | 2 = obj['round'] === 2 ? 2 : 1;

  const background: 'room' | 'outside' =
    obj['background'] === 'room' || obj['background'] === 'outside'
      ? obj['background']
      : round === 2 ? 'outside' : 'room';

  const opponent: 'wan_mahora' | 'village_chief' =
    obj['opponent'] === 'wan_mahora' || obj['opponent'] === 'village_chief'
      ? obj['opponent']
      : round === 2 ? 'village_chief' : 'wan_mahora';

  const rawSeeds = obj['seedsPerHole'];
  const seedsPerHole =
    typeof rawSeeds === 'number' && Number.isInteger(rawSeeds) && rawSeeds > 0
      ? rawSeeds
      : round === 2 ? 4 : 3;

  return { round, seedsPerHole, background, opponent };
}

// ---------------------------------------------------------------------------
// Seed colours
// ---------------------------------------------------------------------------

export const SEED_COLOURS = ['black', 'blue', 'green', 'red', 'white', 'yellow'] as const;
export type SeedColour = (typeof SEED_COLOURS)[number];

export function getSeedColour(seedIndex: number): SeedColour {
  return SEED_COLOURS[((seedIndex % SEED_COLOURS.length) + SEED_COLOURS.length) % SEED_COLOURS.length];
}

// ---------------------------------------------------------------------------
// Board geometry — centres of the 8 positions in the 1920×1080 canvas.
// congkak_board.png (1220×186) drawn 1000 px wide, bottom-centre at (960, 1050).
//   Player holes 0,1,2 = bottom row, left → right
//   Player house 3     = right end ("YOUR HOUSE")
//   Opp holes 4,5,6    = top row, right → left
//   Opp house 7        = left end ("OPPONENT")
// ---------------------------------------------------------------------------

export const HOLE_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 812, y: 1005 },  // 0 player hole (left)
  { x: 958, y: 1005 },  // 1 player hole (centre)
  { x: 1105, y: 1005 }, // 2 player hole (right)
  { x: 1304, y: 964 },  // 3 player house
  { x: 1099, y: 937 },  // 4 opp hole (right)
  { x: 960, y: 937 },   // 5 opp hole (centre)
  { x: 821, y: 937 },   // 6 opp hole (left)
  { x: 616, y: 964 },   // 7 opp house
];

/** Where each count badge sits: just outside the top-right edge of its hole. */
export function labelPosition(index: number): { x: number; y: number } {
  const p = HOLE_POSITIONS[index];
  if (index === 3 || index === 7) return { x: p.x, y: p.y - 72 };
  return { x: p.x + 66, y: p.y - 24 };
}

/**
 * Deterministic scatter for resting seeds, so seeds don't jump around every
 * time a hole is redrawn. Houses get a wider spread.
 */
export function seedOffset(index: number, i: number): { dx: number; dy: number } {
  const isHouse = index === 3 || index === 7;
  const ring = Math.floor(i / 6);
  const angle = (i * 137.5 + index * 40) * (Math.PI / 180);
  const r = (isHouse ? 26 : 14) + ring * (isHouse ? 18 : 9);
  const rx = Math.min(r, isHouse ? 95 : 42);
  const ry = Math.min(r * 0.55, isHouse ? 50 : 18);
  return { dx: Math.cos(angle) * rx, dy: Math.sin(angle) * ry };
}

// ---------------------------------------------------------------------------
// selectOpponentHole — simple AI: extra turn > capture > random
// ---------------------------------------------------------------------------

export function selectOpponentHole(board: Board, rand: () => number = Math.random): number {
  const legal = (OPP_HOLES as readonly number[]).filter((h) => board[h] > 0);
  if (legal.length === 0) {
    throw new RangeError('selectOpponentHole: no legal opponent moves available');
  }
  const previews = legal.map((h) => ({ hole: h, preview: previewLastSeed(board, h, false) }));

  const extraTurn = previews.find((p) => p.preview.willExtraTurn);
  if (extraTurn) return extraTurn.hole;

  const capture = previews.find((p) => p.preview.willCapture);
  if (capture) return capture.hole;

  return legal[Math.floor(rand() * legal.length)];
}

/** Result text for the end-of-round overlay. A draw counts as a loss. */
export function resultMessage(result: 'player' | 'opponent' | 'draw'): string {
  return result === 'player' ? 'You win!' : 'You lose.';
}
