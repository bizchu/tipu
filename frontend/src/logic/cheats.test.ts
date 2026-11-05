import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { planCheats, playOpponentMove, damage, hitTest, CheatType } from './cheats';
import { Board, makeBoard, totalSeeds, hasLegalMove } from './congkak';

const seeded = (seed: number) => () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

describe('planCheats', () => {
  it('round 1: two cheats, first is always extraSeed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (s) => {
        const plan = planCheats(1, seeded(s));
        const types = [...plan.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
        expect(types).toHaveLength(2);
        expect(types[0]).toBe('extraSeed');
        expect(types[1]).toBe('skipHole');
      }),
    );
  });

  it('round 2: three cheats, exactly one lightsOut, no repeats in a row', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (s) => {
        const plan = planCheats(2, seeded(s));
        const types = [...plan.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
        expect(types).toHaveLength(3);
        expect(types.filter((t) => t === 'lightsOut')).toHaveLength(1);
        for (let i = 1; i < types.length; i++) expect(types[i]).not.toBe(types[i - 1]);
        [...plan.keys()].forEach((t) => expect(t).toBeGreaterThanOrEqual(0));
      }),
    );
  });

  it('is random across retries', () => {
    const plans = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify([...planCheats(2, seeded(s * 7919))])));
    expect(plans.size).toBeGreaterThan(1);
  });
});

describe('playOpponentMove', () => {
  const boardArb = fc
    .tuple(...Array.from({ length: 8 }, (_, i) => fc.integer({ min: 0, max: i === 3 || i === 7 ? 10 : 6 })))
    .map((t) => t as unknown as Board)
    .filter((b) => hasLegalMove(b, false));

  const cheats: CheatType[] = ['extraSeed', 'skipHole', 'steal', 'houseSkim', 'lightsOut'];

  it('a clean move keeps the seed total', () => {
    fc.assert(
      fc.property(boardArb, (b) => {
        const hole = [4, 5, 6].find((h) => b[h] > 0)!;
        const m = playOpponentMove(b, hole, null);
        expect(totalSeeds(m.finalBoard)).toBe(totalSeeds(b));
        expect(m.cheat).toBeNull();
      }),
    );
  });

  it('every cheat except extraSeed keeps the total; extraSeed adds exactly one', () => {
    fc.assert(
      fc.property(boardArb, fc.constantFrom(...cheats), fc.integer({ min: 1, max: 9999 }), (b, c, s) => {
        const hole = [4, 5, 6].find((h) => b[h] > 0)!;
        const m = playOpponentMove(b, hole, c, seeded(s));
        const diff = totalSeeds(m.finalBoard) - totalSeeds(b);
        if (m.cheat?.type === 'extraSeed') expect(diff).toBe(1);
        else expect(diff).toBe(0);
        m.finalBoard.forEach((n) => expect(n).toBeGreaterThanOrEqual(0));
      }),
    );
  });

  it('cheats always hurt the player or help the opponent', () => {
    fc.assert(
      fc.property(boardArb, fc.constantFrom(...cheats), (b, c) => {
        const hole = [4, 5, 6].find((h) => b[h] > 0)!;
        const m = playOpponentMove(b, hole, c, () => 0.3);
        if (!m.cheat) return;
        const mine = (x: Board) => x[0] + x[1] + x[2] + x[3];
        const theirs = (x: Board) => x[4] + x[5] + x[6] + x[7];
        expect(mine(m.finalBoard) <= mine(m.legalBoard) && theirs(m.finalBoard) >= theirs(m.legalBoard)).toBe(true);
      }),
    );
  });

  it('houseSkim is skipped when your house is empty', () => {
    const m = playOpponentMove(makeBoard(3), 4, 'houseSkim');
    expect(m.cheat).toBeNull();
  });
});

describe('tape health and hit test', () => {
  it('never drops below zero', () => {
    expect(damage(0.2, 0.25)).toBe(0);
    expect(damage(1, 0.25)).toBe(0.75);
  });
  it('detects taps inside the circle', () => {
    expect(hitTest(10, 10, 0, 0, 20)).toBe(true);
    expect(hitTest(30, 0, 0, 0, 20)).toBe(false);
  });
});
