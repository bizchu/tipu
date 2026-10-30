/**
 * Pure congkak game logic — no Phaser imports, fully unit-testable.
 *
 * Board layout (indices 0-6):
 *   Player holes : 0, 1, 2   (left → right)
 *   Player house : 3
 *   Opponent holes: 4, 5, 6  (right → left, i.e. anticlockwise continuation)
 *   Opponent house: — (index 7, not in the array; skipped during sowing)
 *
 * The board is represented as a flat array of 8 numbers:
 *   [p0, p1, p2, pHouse, o0, o1, o2, oHouse]
 *    0    1   2    3      4   5   6     7
 *
 * Anticlockwise sowing order starting from a player hole h:
 *   h+1, h+2, …, 3 (player house), 4, 5, 6, (skip 7), 0, 1, …
 */

export type Board = [
  number,
  number,
  number,
  number, // player house
  number,
  number,
  number,
  number, // opponent house (skipped when sowing)
];

export const PLAYER_HOLES = [0, 1, 2] as const;
export const PLAYER_HOUSE = 3;
export const OPP_HOLES = [4, 5, 6] as const;
export const OPP_HOUSE = 7;

/** Opposite hole mapping for tembak (capture). */
const OPPOSITE: Readonly<Record<number, number>> = {
  0: 6,
  1: 5,
  2: 4,
  4: 2,
  5: 1,
  6: 0,
};

function nextIndex(i: number): number {
  // Cycles 0→1→2→3→4→5→6→0, skipping index 7 (opp house)
  const next = (i + 1) % 8;
  return next === OPP_HOUSE ? 0 : next;
}

/** Returns the full sowing path starting one step after `fromHole`. */
function sowingPath(fromHole: number, count: number): number[] {
  const path: number[] = [];
  let cur = nextIndex(fromHole);
  for (let i = 0; i < count; i++) {
    path.push(cur);
    cur = nextIndex(cur);
  }
  return path;
}

export interface MoveResult {
  board: Board;
  /** true → the moving player gets another turn */
  extraTurn: boolean;
  /** true → a tembak (capture) happened */
  captured: boolean;
  /** index of hole that was captured (if any) */
  captureHole?: number;
}

/**
 * Apply a legal sowing move for the player starting from `holeIndex`.
 * Does NOT validate that the hole belongs to the player; callers must check.
 */
export function applyMove(board: Board, holeIndex: number): MoveResult {
  const b: Board = [...board] as Board;
  let seeds = b[holeIndex];
  b[holeIndex] = 0;

  const path = sowingPath(holeIndex, seeds);

  for (const idx of path) {
    b[idx]++;
  }

  const lastIdx = path[path.length - 1];

  // Last seed landed in the player's house → extra turn
  if (lastIdx === PLAYER_HOUSE) {
    return { board: b, extraTurn: true, captured: false };
  }

  // Last seed landed in a non-empty hole (before we added) → keep sowing
  // (this is handled recursively / iteratively by the caller in real play;
  //  here we return the intermediate state so the scene can animate it)

  // Last seed landed in an empty player hole (was 1 after sowing, so check === 1)
  const isPlayerHole = (PLAYER_HOLES as readonly number[]).includes(lastIdx);
  if (isPlayerHole && b[lastIdx] === 1) {
    const opp = OPPOSITE[lastIdx];
    if (opp !== undefined && b[opp] > 0) {
      // Tembak: capture seeds from opposite hole + the landing seed
      b[PLAYER_HOUSE] += b[opp] + 1;
      b[opp] = 0;
      b[lastIdx] = 0;
      return { board: b, extraTurn: false, captured: true, captureHole: opp };
    }
  }

  return { board: b, extraTurn: false, captured: false };
}

/** Total seeds on the board (invariant: must equal initial count). */
export function totalSeeds(board: Board): number {
  return board.reduce((acc, n) => acc + n, 0);
}

/** True if the moving side has at least one legal move. */
export function hasLegalMove(board: Board, isPlayer: boolean): boolean {
  const holes = isPlayer ? PLAYER_HOLES : OPP_HOLES;
  return holes.some((h) => board[h] > 0);
}

/** Create a starting board for a given seed count per hole. */
export function makeBoard(seedsPerHole: number): Board {
  return [
    seedsPerHole,
    seedsPerHole,
    seedsPerHole,
    0,
    seedsPerHole,
    seedsPerHole,
    seedsPerHole,
    0,
  ];
}
