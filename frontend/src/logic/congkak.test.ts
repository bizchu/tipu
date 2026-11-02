import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  applyMove,
  applyFullMove,
  makeBoard,
  totalSeeds,
  hasLegalMove,
  getWinner,
  PLAYER_HOLES,
  OPP_HOLES,
  type Board,
} from "./congkak";

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("makeBoard", () => {
  it("creates a board with correct seed totals", () => {
    const b3 = makeBoard(3);
    expect(totalSeeds(b3)).toBe(18); // round 1
    const b4 = makeBoard(4);
    expect(totalSeeds(b4)).toBe(24); // round 2
  });

  it("starts with empty houses", () => {
    const b = makeBoard(3);
    expect(b[3]).toBe(0); // player house
    expect(b[7]).toBe(0); // opponent house
  });
});

describe("applyMove", () => {
  it("removes seeds from the chosen hole", () => {
    const b = makeBoard(3);
    const { board } = applyMove(b, 0, true);
    expect(board[0]).toBe(0);
  });

  it("grants an extra turn when last seed lands in player house", () => {
    // Craft a board where hole 2 has exactly 1 seed so it lands on house (index 3)
    const b: Board = [0, 0, 1, 0, 3, 3, 3, 0];
    const { extraTurn } = applyMove(b, 2, true);
    expect(extraTurn).toBe(true);
  });

  it("performs tembak when last seed lands in empty player hole opposite a non-empty opp hole", () => {
    // Sow from hole 2 with 5 seeds: path = [3, 4, 5, 6, 0]
    // During sowing: b[3]→1, b[4]→3, b[5]→3, b[6]→4, b[0]→1 (landing)
    // b[0] was 0, now 1 → empty before sowing → tembak fires
    // opp[6] after sowing = 4; tembak adds b[6]+1 = 5 on top of existing b[3]=1
    // final b[3] = 1 + 4 + 1 = 6
    const b: Board = [0, 0, 5, 0, 2, 2, 3, 0];
    const { captured, captureHole, board } = applyMove(b, 2, true);
    expect(captured).toBe(true);
    expect(captureHole).toBe(6);
    // house: 1 (seeded during sow) + 4 (opp[6] after sow) + 1 (landing seed) = 6
    expect(board[3]).toBe(6);
    expect(board[6]).toBe(0);
    expect(board[0]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests (fast-check)
// ---------------------------------------------------------------------------

/** Shared arbitrary for a random board (unconstrained numeric values). */
const boardArb = fc.tuple(
  fc.integer({ min: 0, max: 10 }),  // p0
  fc.integer({ min: 0, max: 10 }),  // p1
  fc.integer({ min: 0, max: 10 }),  // p2
  fc.integer({ min: 0, max: 20 }),  // playerHouse
  fc.integer({ min: 0, max: 10 }),  // o0
  fc.integer({ min: 0, max: 10 }),  // o1
  fc.integer({ min: 0, max: 10 }),  // o2
  fc.integer({ min: 0, max: 20 }),  // oppHouse
) as fc.Arbitrary<Board>;

/** Returns the first non-empty legal hole for the given side, or null if none. */
function pickAnyLegalHole(board: Board, isPlayer: boolean): number | null {
  const holes = isPlayer ? PLAYER_HOLES : OPP_HOLES;
  for (const h of holes) {
    if (board[h] > 0) return h;
  }
  return null;
}

describe("Feature: congkak-rules, Property 1: makeBoard houses are always zero", () => {
  it("makeBoard houses are always zero", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        (seedsPerHole) => {
          const b = makeBoard(seedsPerHole);
          return b[3] === 0 && b[7] === 0;
        },
      ),
    );
  });
});

describe("Feature: congkak-rules, Property 2: makeBoard total seeds equals seedsPerHole × 6", () => {
  it("makeBoard total seeds equals seedsPerHole × 6", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        (seedsPerHole) => {
          return totalSeeds(makeBoard(seedsPerHole)) === seedsPerHole * 6;
        },
      ),
    );
  });
});

describe("Feature: congkak-rules, Property 3: Player sowing never deposits in opponent's house", () => {
  it("player move never touches opponent's house (index 7)", () => {
    fc.assert(
      fc.property(
        boardArb,
        fc.integer({ min: 0, max: 2 }),
        (board, holeIdx) => {
          fc.pre(board[holeIdx] > 0);
          const result = applyMove(board, holeIdx, true);
          return result.board[7] === board[7];
        },
      ),
    );
  });
});

describe("Feature: congkak-rules, Property 4: Opponent sowing never deposits in player's house", () => {
  it("opponent move never touches player's house (index 3)", () => {
    fc.assert(
      fc.property(
        boardArb,
        fc.integer({ min: 4, max: 6 }),
        (board, holeIdx) => {
          fc.pre(board[holeIdx] > 0);
          const result = applyMove(board, holeIdx, false);
          return result.board[3] === board[3];
        },
      ),
    );
  });
});

describe("Feature: congkak-rules, Property 5: applyMove preserves total seed count", () => {
  it("player move never changes total seed count", () => {
    fc.assert(
      fc.property(
        boardArb,
        fc.integer({ min: 0, max: 2 }),
        (board, holeIdx) => {
          fc.pre(board[holeIdx] > 0);
          const before = totalSeeds(board);
          const { board: after } = applyMove(board, holeIdx, true);
          return totalSeeds(after) === before;
        },
      ),
    );
  });

  it("opponent move never changes total seed count", () => {
    fc.assert(
      fc.property(
        boardArb,
        fc.integer({ min: 4, max: 6 }),
        (board, holeIdx) => {
          fc.pre(board[holeIdx] > 0);
          const before = totalSeeds(board);
          const { board: after } = applyMove(board, holeIdx, false);
          return totalSeeds(after) === before;
        },
      ),
    );
  });
});

describe("Feature: congkak-rules, Property 10: Complete game from round-1 board terminates", () => {
  it("a complete game from makeBoard(3) always terminates within 500 turns", () => {
    let turns = 0;
    let board = makeBoard(3);
    let isPlayer = true; // player always moves first

    while (turns < 500) {
      if (!hasLegalMove(board, isPlayer)) break;
      const hole = pickAnyLegalHole(board, isPlayer);
      if (hole === null) break;
      const result = applyFullMove(board, hole, isPlayer);
      board = result.board;
      // Extra turn: same side moves again; otherwise swap
      if (!result.extraTurn) {
        isPlayer = !isPlayer;
      }
      turns++;
    }

    expect(turns).toBeLessThan(500);
  });
});

describe("Feature: congkak-rules, Property 11: Complete game from round-2 board terminates", () => {
  it("a complete game from makeBoard(4) always terminates within 500 turns", () => {
    let turns = 0;
    let board = makeBoard(4);
    let isPlayer = true;

    while (turns < 500) {
      if (!hasLegalMove(board, isPlayer)) break;
      const hole = pickAnyLegalHole(board, isPlayer);
      if (hole === null) break;
      const result = applyFullMove(board, hole, isPlayer);
      board = result.board;
      if (!result.extraTurn) {
        isPlayer = !isPlayer;
      }
      turns++;
    }

    expect(turns).toBeLessThan(500);
  });
});

describe("hasLegalMove", () => {
  it("returns false when all player holes are empty", () => {
    const b: Board = [0, 0, 0, 5, 3, 3, 3, 0];
    expect(hasLegalMove(b, true)).toBe(false);
  });

  it("returns true when at least one player hole is non-empty", () => {
    const b: Board = [0, 0, 1, 5, 3, 3, 3, 0];
    expect(hasLegalMove(b, true)).toBe(true);
  });
});

describe("getWinner", () => {
  it("returns 'player' when player house > opponent house", () => {
    const b: Board = [0, 0, 0, 10, 0, 0, 0, 8];
    expect(getWinner(b)).toBe("player");
  });

  it("returns 'opponent' when opponent house > player house", () => {
    const b: Board = [0, 0, 0, 6, 0, 0, 0, 12];
    expect(getWinner(b)).toBe("opponent");
  });

  it("returns 'draw' when houses are equal", () => {
    const b: Board = [0, 0, 0, 9, 0, 0, 0, 9];
    expect(getWinner(b)).toBe("draw");
  });

  it("returns 'draw' when both houses are 0", () => {
    const b: Board = [3, 3, 3, 0, 3, 3, 3, 0];
    expect(getWinner(b)).toBe("draw");
  });
});
