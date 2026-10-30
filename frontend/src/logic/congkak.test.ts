import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  applyMove,
  makeBoard,
  totalSeeds,
  hasLegalMove,
  PLAYER_HOLES,
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
    const { board } = applyMove(b, 0);
    expect(board[0]).toBe(0);
  });

  it("grants an extra turn when last seed lands in player house", () => {
    // Craft a board where hole 2 has exactly 1 seed so it lands on house (index 3)
    const b: Board = [0, 0, 1, 0, 3, 3, 3, 0];
    const { extraTurn } = applyMove(b, 2);
    expect(extraTurn).toBe(true);
  });

  it("performs tembak when last seed lands in empty player hole opposite a non-empty opp hole", () => {
    // Sow from hole 2 with 5 seeds: path = [3, 4, 5, 6, 0]
    // During sowing: b[3]→1, b[4]→3, b[5]→3, b[6]→4, b[0]→1 (landing)
    // b[0] was 0, now 1 → empty before sowing → tembak fires
    // opp[6] after sowing = 4; tembak adds b[6]+1 = 5 on top of existing b[3]=1
    // final b[3] = 1 + 4 + 1 = 6
    const b: Board = [0, 0, 5, 0, 2, 2, 3, 0];
    const { captured, captureHole, board } = applyMove(b, 2);
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

describe("totalSeeds invariant", () => {
  it("a legal sowing never changes the total seed count", () => {
    fc.assert(
      fc.property(
        // Pick a random legal board: 3 player holes, player house, 3 opp holes, opp house
        fc.tuple(
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 16 }),
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 16 }),
        ),
        fc.integer({ min: 0, max: 2 }), // which player hole to move from
        ([p0, p1, p2, ph, o0, o1, o2, oh], holeIdx) => {
          const board: Board = [p0, p1, p2, ph, o0, o1, o2, oh];
          const hole = PLAYER_HOLES[holeIdx];
          // Only apply the move if the chosen hole is non-empty
          if (board[hole] === 0) return true;
          const before = totalSeeds(board);
          const { board: after } = applyMove(board, hole);
          return totalSeeds(after) === before;
        },
      ),
    );
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
