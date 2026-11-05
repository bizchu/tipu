/**
 * Opponent cheats: pure logic, no Phaser. See .kiro/steering/gameplay.md.
 *
 * A cheat is applied on top of an otherwise legal opponent move:
 *  - extraSeed  (Wan Mahora) one drop into a hole adds an extra seed from her sleeve (+1 total)
 *  - skipHole   (Wan Mahora) her hand passes over one of YOUR holes but keeps the seed (it ends up in her house)
 *  - steal      (chief)      after his move he pinches a seed from your fullest hole into his house
 *  - houseSkim  (chief)      he slips a seed from your house into his house
 *  - lightsOut  (chief)      the lamp flickers and your fullest hole swaps with his emptiest hole
 */
import { Board, PLAYER_HOLES, OPP_HOLES, PLAYER_HOUSE, OPP_HOUSE, SeedStep, applyFullMove, getSeedPath } from './congkak';

export type CheatType = 'extraSeed' | 'skipHole' | 'steal' | 'houseSkim' | 'lightsOut';

export const CHEAT_POOLS: Record<1 | 2, CheatType[]> = {
  1: ['extraSeed', 'skipHole'],
  2: ['steal', 'houseSkim', 'lightsOut'],
};

/** Human-readable tells, shown after a successful catch. */
export const CHEAT_TELLS: Record<CheatType, string> = {
  extraSeed: 'She dropped an extra seed from her sleeve!',
  skipHole: 'Her hand skipped your hole and kept the seed!',
  steal: 'He pinched a seed out of your hole!',
  houseSkim: 'He slipped a seed out of YOUR house!',
  lightsOut: 'In the dark, he swapped your hole with his!',
};

/** Which opponent turns (0-based) will cheat, and with what. */
export type CheatPlan = Map<number, CheatType>;

/**
 * Builds a random cheat plan for a round.
 *  - Round 1: 2 cheats; the first is always extraSeed (tutorial).
 *  - Round 2: 3 cheats, including exactly one lightsOut at a random point.
 *  - The same cheat never happens twice in a row.
 *  - Cheats land on opponent turns 1..6 so they happen early enough to matter.
 */
export function planCheats(round: 1 | 2, rand: () => number = Math.random): CheatPlan {
  const count = round === 1 ? 2 : 3;
  const turns = pickDistinct([0, 1, 2, 3, 4, 5], count, rand).sort((a, b) => a - b);
  const types: CheatType[] = [];
  if (round === 1) {
    types.push('extraSeed');
    while (types.length < count) types.push(nextNot(CHEAT_POOLS[1], types[types.length - 1], rand));
  } else {
    const lightsAt = Math.floor(rand() * count);
    for (let i = 0; i < count; i++) {
      if (i === lightsAt) {
        types.push('lightsOut');
        continue;
      }
      const prev = types[i - 1];
      const pool: CheatType[] = ['steal', 'houseSkim'];
      // avoid repeats, and avoid lightsOut next to... (pool never contains lightsOut)
      types.push(nextNot(pool, prev, rand));
    }
  }
  const plan: CheatPlan = new Map();
  turns.forEach((t, i) => plan.set(t, types[i]));
  return plan;
}

function pickDistinct<T>(arr: T[], n: number, rand: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

function nextNot(pool: CheatType[], prev: CheatType | undefined, rand: () => number): CheatType {
  const options = pool.filter((c) => c !== prev);
  return options[Math.floor(rand() * options.length)];
}

/** Description of a cheat that actually happened, used by the replay to make it catchable. */
export interface CheatEvent {
  type: CheatType;
  /** For extraSeed / skipHole: index into the move's steps where the cheat happens. Else -1 (after the move). */
  stepIndex: number;
  /** The board position where the cheat is visible (where to tap). */
  hole: number;
  /** Second hole involved (lightsOut swap, steal destination house, etc). */
  otherHole?: number;
}

export interface CheatedMove {
  /** Legal steps of the move (animated as normal). */
  steps: SeedStep[];
  /** Board after the legal move, before the cheat. */
  legalBoard: Board;
  /** Board after the legal move AND the cheat. */
  finalBoard: Board;
  extraTurn: boolean;
  captured: boolean;
  cheat: CheatEvent | null;
}

/**
 * Plays an opponent move and, if possible, applies the given cheat on top.
 * If the cheat can't apply on this board (e.g. your house is empty for houseSkim),
 * the move is returned clean with `cheat: null`, so the scene can try again later.
 */
export function playOpponentMove(board: Board, hole: number, cheat: CheatType | null, rand: () => number = Math.random): CheatedMove {
  const steps = getSeedPath(board, hole, false);
  const legal = applyFullMove(board, hole, false);
  const base: CheatedMove = {
    steps,
    legalBoard: legal.board,
    finalBoard: [...legal.board] as Board,
    extraTurn: legal.extraTurn,
    captured: legal.captured,
    cheat: null,
  };
  if (!cheat) return base;

  const b = [...legal.board] as Board;
  const playerHoles = PLAYER_HOLES as readonly number[];
  const oppHoles = OPP_HOLES as readonly number[];

  switch (cheat) {
    case 'extraSeed': {
      // choose a sow step into one of HER holes or her house (so the extra helps her)
      const idx = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.type === 'sow' && (oppHoles.includes(s.toHole) || s.toHole === OPP_HOUSE));
      if (!idx.length) return base;
      const pick = idx[Math.floor(rand() * idx.length)];
      b[pick.s.toHole] += 1;
      return { ...base, finalBoard: b, cheat: { type: cheat, stepIndex: pick.i, hole: pick.s.toHole } };
    }
    case 'skipHole': {
      const idx = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.type === 'sow' && playerHoles.includes(s.toHole));
      if (!idx.length) return base;
      const pick = idx[Math.floor(rand() * idx.length)];
      if (b[pick.s.toHole] === 0) return base;
      b[pick.s.toHole] -= 1;
      b[OPP_HOUSE] += 1;
      return { ...base, finalBoard: b, cheat: { type: cheat, stepIndex: pick.i, hole: pick.s.toHole, otherHole: OPP_HOUSE } };
    }
    case 'steal': {
      const from = fullest(b, playerHoles);
      if (from < 0) return base;
      b[from] -= 1;
      b[OPP_HOUSE] += 1;
      return { ...base, finalBoard: b, cheat: { type: cheat, stepIndex: -1, hole: from, otherHole: OPP_HOUSE } };
    }
    case 'houseSkim': {
      if (b[PLAYER_HOUSE] === 0) return base;
      b[PLAYER_HOUSE] -= 1;
      b[OPP_HOUSE] += 1;
      return { ...base, finalBoard: b, cheat: { type: cheat, stepIndex: -1, hole: PLAYER_HOUSE, otherHole: OPP_HOUSE } };
    }
    case 'lightsOut': {
      const mine = fullest(b, playerHoles);
      const his = emptiest(b, oppHoles);
      if (mine < 0 || his < 0 || b[mine] <= b[his]) return base;
      [b[mine], b[his]] = [b[his], b[mine]];
      return { ...base, finalBoard: b, cheat: { type: cheat, stepIndex: -1, hole: mine, otherHole: his } };
    }
  }
}

function fullest(b: Board, holes: readonly number[]): number {
  let best = -1;
  for (const h of holes) if (b[h] > 0 && (best < 0 || b[h] > b[best])) best = h;
  return best;
}

function emptiest(b: Board, holes: readonly number[]): number {
  let best = -1;
  for (const h of holes) if (best < 0 || b[h] < b[best]) best = h;
  return best;
}

// ---------------------------------------------------------------------------
// Tape health
// ---------------------------------------------------------------------------

export const TAPE = {
  start: 1,
  wrongTap: 0.25,
  cleanRewind: 0.2,
  missedWindow: 0.25,
} as const;

export function damage(health: number, amount: number): number {
  return Math.max(0, Math.round((health - amount) * 100) / 100);
}

/** True when a tap at (x, y) within the replay hits the cheat region (circle of radius r). */
export function hitTest(tx: number, ty: number, cx: number, cy: number, r: number): boolean {
  return (tx - cx) ** 2 + (ty - cy) ** 2 <= r * r;
}
