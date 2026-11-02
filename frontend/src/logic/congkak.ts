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

/**
 * Validates that a hole index is legal for the given mover before a move.
 * Throws RangeError if:
 *   - holeIndex is outside 0–6
 *   - holeIndex is not in the mover's valid hole set
 *   - the hole is empty
 */
function validateHole(board: Board, holeIndex: number, isPlayer: boolean): void {
  if (holeIndex < 0 || holeIndex > 6) {
    throw new RangeError(`holeIndex must be 0–6, got ${holeIndex}`);
  }
  const validHoles = isPlayer ? PLAYER_HOLES : OPP_HOLES;
  if (!(validHoles as readonly number[]).includes(holeIndex)) {
    throw new RangeError(`holeIndex ${holeIndex} is not valid for isPlayer=${isPlayer}`);
  }
  if (board[holeIndex] === 0) {
    throw new RangeError(`hole ${holeIndex} is empty`);
  }
}

/**
 * Advances anticlockwise by one step, skipping the house of the opposing side.
 * - isPlayer true  → skips index 7 (opponent's house)
 * - isPlayer false → skips index 3 (player's house)
 */
function nextIndexFor(i: number, isPlayer: boolean): number {
  const skip = isPlayer ? OPP_HOUSE : PLAYER_HOUSE;
  let next = (i + 1) % 8;
  if (next === skip) next = (next + 1) % 8;
  return next;
}

/** Returns the full sowing path starting one step after `fromHole`. */
function sowingPathFor(fromHole: number, count: number, isPlayer: boolean): number[] {
  const path: number[] = [];
  let cur = nextIndexFor(fromHole, isPlayer);
  for (let i = 0; i < count; i++) {
    path.push(cur);
    cur = nextIndexFor(cur, isPlayer);
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
  /** The slot where the last seed landed. Callers use this to continue keep-sowing. */
  nextHole: number;
}

/**
 * Internal sowing engine — no validation, works for any non-empty hole index 0–6.
 * Used by `applyMove` (after validation) and by `applyFullMove`/`getSeedPath` for
 * keep-sowing continuation steps, which may land on cross-side holes.
 */
function applyMoveRaw(board: Board, holeIndex: number, isPlayer: boolean): MoveResult {
  const b: Board = [...board] as Board;
  const seeds = b[holeIndex];
  b[holeIndex] = 0;

  const path = sowingPathFor(holeIndex, seeds, isPlayer);

  for (const idx of path) {
    b[idx]++;
  }

  const lastIdx = path[path.length - 1];
  const moverHouse = isPlayer ? PLAYER_HOUSE : OPP_HOUSE;
  const moverHoles: readonly number[] = isPlayer ? PLAYER_HOLES : OPP_HOLES;

  // Last seed landed in the mover's own house → extra turn
  if (lastIdx === moverHouse) {
    return { board: b, extraTurn: true, captured: false, nextHole: lastIdx };
  }

  // Last seed landed in an empty hole on the mover's own side
  // (b[lastIdx] === 1 means the hole had 0 seeds before the sow; we just added the 1)
  if (moverHoles.includes(lastIdx) && b[lastIdx] === 1) {
    const opp = OPPOSITE[lastIdx];
    if (opp !== undefined && b[opp] > 0) {
      // Tembak: move landing seed + all seeds from opposite hole into mover's house
      b[moverHouse] += b[opp] + 1;
      b[opp] = 0;
      b[lastIdx] = 0;
      return { board: b, extraTurn: false, captured: true, captureHole: opp, nextHole: lastIdx };
    }
    // Opposite hole is empty → turn ends, no capture
    return { board: b, extraTurn: false, captured: false, nextHole: lastIdx };
  }

  // Any other landing (non-empty hole → keep-sowing signal, or empty opponent hole → terminal)
  return { board: b, extraTurn: false, captured: false, nextHole: lastIdx };
}

/**
 * Apply a legal sowing move starting from `holeIndex`.
 * `isPlayer` controls whose perspective is used:
 *   - true  → player move (holes 0–2, house 3, skips index 7)
 *   - false → opponent move (holes 4–6, house 7, skips index 3)
 *
 * Validates the hole before touching the board; throws RangeError on invalid input.
 * Returns a MoveResult whose `nextHole` is always set to the landing slot.
 * The caller uses `nextHole` plus the keep-sowing detection rule to decide
 * whether to invoke `applyMove` again:
 *   keepSow = !extraTurn && !captured && result.board[result.nextHole] > 1
 */
export function applyMove(board: Board, holeIndex: number, isPlayer: boolean = true): MoveResult {
  validateHole(board, holeIndex, isPlayer);
  return applyMoveRaw(board, holeIndex, isPlayer);
}

export interface FullMoveResult {
  board: Board;
  extraTurn: boolean;
  captured: boolean;
  captureHole?: number;
}

/**
 * Fully resolves a complete turn, following keep-sowing chains until the turn ends.
 * Calls `validateHole` before the loop — throws `RangeError` on invalid input.
 * Throws `Error` after 200 iterations (cycle guard).
 *
 * Keep-sowing continues while:
 *   !extraTurn && !captured && result.board[result.nextHole] > 1
 *
 * The `> 1` check: the sow added 1 seed to nextHole. If it's now 1 the hole was
 * empty before (terminal); if 2+ it was already occupied — pick them up.
 */
export function applyFullMove(board: Board, holeIndex: number, isPlayer: boolean): FullMoveResult {
  validateHole(board, holeIndex, isPlayer);

  let result: MoveResult = applyMoveRaw(board, holeIndex, isPlayer);
  let iterations = 1;

  while (!result.extraTurn && !result.captured && result.board[result.nextHole] > 1) {
    if (iterations >= 200) {
      throw new Error('applyFullMove: cycle guard triggered after 200 iterations');
    }
    // Keep-sowing may land on cross-side holes; use applyMoveRaw to skip ownership validation.
    result = applyMoveRaw(result.board, result.nextHole, isPlayer);
    iterations++;
  }

  return {
    board: result.board,
    extraTurn: result.extraTurn,
    captured: result.captured,
    captureHole: result.captureHole,
  };
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

/** The outcome of a completed congkak game. */
export type GameResult = 'player' | 'opponent' | 'draw';

// ---------------------------------------------------------------------------
// PreviewResult — last-seed preview for UI hints (task 8)
// ---------------------------------------------------------------------------

/**
 * Describes the predicted outcome of a full move without mutating the board.
 * Returned by `previewLastSeed`.
 */
export interface PreviewResult {
  /** The index of the hole where the last seed lands after all keep-sowing. */
  landingHole: number;
  /** True if a tembak capture will occur. */
  willCapture: boolean;
  /** True if the mover earns an extra turn. */
  willExtraTurn: boolean;
  /** True if the last seed lands in a non-empty hole (keep-sowing continues). */
  willKeepSow: boolean;
}

/**
 * Predicts the outcome of a full move without mutating the input board.
 *
 * Runs the same keep-sowing loop as `applyFullMove` on a copy of the board,
 * then derives the four `PreviewResult` fields from the final `MoveResult`.
 *
 * - `landingHole`   — the index where the last seed ended up
 * - `willCapture`   — true if a tembak capture will occur
 * - `willExtraTurn` — true if the mover earns another turn
 * - `willKeepSow`   — always false (all keep-sowing is fully resolved)
 *
 * Throws `RangeError` for the same invalid inputs as `applyMove`.
 * Throws `Error` after 200 iterations (cycle guard).
 * The original `board` is never touched.
 */
export function previewLastSeed(board: Board, holeIndex: number, isPlayer: boolean): PreviewResult {
  validateHole(board, holeIndex, isPlayer);
  const copy = [...board] as Board;

  let result: MoveResult = applyMoveRaw(copy, holeIndex, isPlayer);
  let iterations = 1;

  while (!result.extraTurn && !result.captured && result.board[result.nextHole] > 1) {
    if (iterations >= 200) {
      throw new Error('previewLastSeed: cycle guard triggered after 200 iterations');
    }
    result = applyMoveRaw(result.board, result.nextHole, isPlayer);
    iterations++;
  }

  return {
    landingHole: result.nextHole,
    willCapture: result.captured,
    willExtraTurn: result.extraTurn,
    willKeepSow: false, // applyFullMove resolves all keep-sowing; no pending keep-sow remains
  };
}

// ---------------------------------------------------------------------------
// SeedStep — per-seed animation path (task 7)
// ---------------------------------------------------------------------------

/** The kind of event a SeedStep represents. */
export type SeedStepType = 'sow' | 'extraTurn' | 'tembak' | 'keepSowing';

/**
 * One atomic seed-movement event in a `getSeedPath` result.
 *
 * `seedIndex` is zero-based and assigned sequentially across the entire turn
 * (including keepSowing / extraTurn / tembak marker steps).
 */
export interface SeedStep {
  /** Zero-based index, assigned in strict sowing order across the full turn. */
  seedIndex: number;
  /** The slot this seed departed from. */
  fromHole: number;
  /** The slot this seed arrived at. */
  toHole: number;
  /** The kind of event. */
  type: SeedStepType;
}

/**
 * Determines the winner by comparing house counts.
 * Returns 'player' when board[3] > board[7],
 *         'opponent' when board[7] > board[3],
 *         'draw' when equal.
 * The scene is responsible for treating a draw as a loss (round restart).
 */
export function getWinner(board: Board): GameResult {
  if (board[PLAYER_HOUSE] > board[OPP_HOUSE]) return 'player';
  if (board[OPP_HOUSE] > board[PLAYER_HOUSE]) return 'opponent';
  return 'draw';
}

// ---------------------------------------------------------------------------
// getSeedPath — enumerate every seed movement for animation / VHS replay
// ---------------------------------------------------------------------------

/**
 * Returns a chronological list of every seed movement for one complete turn
 * starting from `holeIndex`, following all keep-sowing continuations.
 *
 * The result is an ordered `SeedStep[]` where each step has a unique,
 * sequential `seedIndex` (0-based) assigned across the entire turn.
 * Step types:
 *   'sow'        — one seed placed in a hole during the sowing pass
 *   'keepSowing' — marker step (fromHole === toHole) when a keep-sow begins
 *   'extraTurn'  — final marker step when the last seed lands in the mover's house
 *   'tembak'     — one seed captured into the mover's house (landing seed first,
 *                  then each seed from the opposite hole, one step each)
 *
 * The input board is never mutated; an internal copy is maintained.
 * Throws `RangeError` on invalid input (same rules as `applyMove`).
 * Throws `Error` after 200 iterations (cycle guard).
 */
export function getSeedPath(board: Board, holeIndex: number, isPlayer: boolean): SeedStep[] {
  validateHole(board, holeIndex, isPlayer);

  const steps: SeedStep[] = [];
  let seedCounter = 0;

  // Internal copy — we update this as we step through each sowing pass.
  const b: Board = [...board] as Board;

  const moverHouse = isPlayer ? PLAYER_HOUSE : OPP_HOUSE;
  const moverHoles: readonly number[] = isPlayer ? PLAYER_HOLES : OPP_HOLES;

  let currentHole = holeIndex;
  let iterations = 0;

  while (true) {
    if (iterations >= 200) {
      throw new Error('getSeedPath: cycle guard triggered after 200 iterations');
    }
    iterations++;

    const seeds = b[currentHole];
    const path = sowingPathFor(currentHole, seeds, isPlayer);

    // --- Emit 'sow' steps for every seed placed this pass ---
    for (const slot of path) {
      steps.push({ seedIndex: seedCounter++, fromHole: currentHole, toHole: slot, type: 'sow' });
    }

    // --- Update internal board: pick up the hole, sow along path ---
    b[currentHole] = 0;
    for (const slot of path) {
      b[slot]++;
    }

    const lastSlot = path[path.length - 1];

    // --- Extra turn: last seed landed in the mover's house ---
    if (lastSlot === moverHouse) {
      steps.push({ seedIndex: seedCounter++, fromHole: lastSlot, toHole: moverHouse, type: 'extraTurn' });
      break;
    }

    // --- Tembak: last seed in an empty mover hole (now exactly 1) with non-empty opposite ---
    if ((moverHoles as readonly number[]).includes(lastSlot) && b[lastSlot] === 1) {
      const opp = OPPOSITE[lastSlot];
      if (opp !== undefined && b[opp] > 0) {
        // Landing seed
        steps.push({ seedIndex: seedCounter++, fromHole: lastSlot, toHole: moverHouse, type: 'tembak' });
        // One step per captured seed from the opposite hole
        const captureCount = b[opp];
        for (let i = 0; i < captureCount; i++) {
          steps.push({ seedIndex: seedCounter++, fromHole: opp, toHole: moverHouse, type: 'tembak' });
        }
        break;
      }
      // Opposite is empty → turn ends (no marker step needed)
      break;
    }

    // --- Keep-sowing: last slot non-empty after the sow (was occupied before) ---
    if (b[lastSlot] > 1) {
      steps.push({ seedIndex: seedCounter++, fromHole: lastSlot, toHole: lastSlot, type: 'keepSowing' });
      currentHole = lastSlot;
      continue;
    }

    // --- Terminal: empty hole on the opponent's side or empty mover hole → turn ends ---
    break;
  }

  return steps;
}
