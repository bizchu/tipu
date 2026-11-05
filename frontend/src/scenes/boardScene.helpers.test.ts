import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseRoundConfig,
  getSeedColour,
  selectOpponentHole,
  SEED_COLOURS,
  HOLE_POSITIONS,
  labelPosition,
  resultMessage,
} from './boardScene.helpers';
import { Board, getSeedPath, previewLastSeed, hasLegalMove } from '../logic/congkak';

const boardArb = fc
  .tuple(
    fc.integer({ min: 0, max: 8 }),
    fc.integer({ min: 0, max: 8 }),
    fc.integer({ min: 0, max: 8 }),
    fc.integer({ min: 0, max: 20 }),
    fc.integer({ min: 0, max: 8 }),
    fc.integer({ min: 0, max: 8 }),
    fc.integer({ min: 0, max: 8 }),
    fc.integer({ min: 0, max: 20 }),
  )
  .map((t) => t as Board);

describe('parseRoundConfig', () => {
  it('defaults to round 1 with no args', () => {
    expect(parseRoundConfig(undefined)).toEqual({ round: 1, seedsPerHole: 3, background: 'room', opponent: 'wan_mahora' });
  });
  it('uses round 2 defaults', () => {
    expect(parseRoundConfig({ round: 2 })).toEqual({ round: 2, seedsPerHole: 4, background: 'outside', opponent: 'village_chief' });
  });
  it('keeps a valid seedsPerHole and discards invalid ones', () => {
    expect(parseRoundConfig({ round: 1, seedsPerHole: 5 }).seedsPerHole).toBe(5);
    for (const bad of [0, -1, 1.5, '3']) {
      expect(parseRoundConfig({ round: 1, seedsPerHole: bad }).seedsPerHole).toBe(3);
    }
  });
  it('falls back to round 1 when round is missing', () => {
    expect(parseRoundConfig({}).round).toBe(1);
  });

  // Feature: board-scene, Property 1: parseRoundConfig always produces valid output
  it('always produces valid output for any input', () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const c = parseRoundConfig(raw);
        expect([1, 2]).toContain(c.round);
        expect(Number.isInteger(c.seedsPerHole) && c.seedsPerHole > 0).toBe(true);
        expect(['room', 'outside']).toContain(c.background);
        expect(['wan_mahora', 'village_chief']).toContain(c.opponent);
      }),
    );
  });

  // Feature: board-scene, Property 2: parseRoundConfig preserves valid seedsPerHole overrides
  it('preserves any positive integer seedsPerHole', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 200 }), (n) => parseRoundConfig({ round: 1, seedsPerHole: n }).seedsPerHole === n));
  });
});

describe('getSeedColour', () => {
  // Feature: board-scene, Property 3: getSeedColour is cyclic
  it('cycles through the six colours', () => {
    fc.assert(fc.property(fc.nat(), (i) => getSeedColour(i) === SEED_COLOURS[i % 6] && getSeedColour(i) === getSeedColour(i + 6)));
  });
});

describe('getSeedPath', () => {
  // Feature: board-scene, Property 4: getSeedPath seedIndex values are strictly sequential from zero
  it('numbers steps 0, 1, 2, ...', () => {
    fc.assert(
      fc.property(boardArb, fc.constantFrom(0, 1, 2), (b, h) => {
        fc.pre(b[h] > 0);
        const steps = getSeedPath(b, h, true);
        steps.forEach((s, k) => expect(s.seedIndex).toBe(k));
      }),
    );
  });
});

describe('selectOpponentHole', () => {
  it('prefers an extra-turn hole', () => {
    // hole 6 with 1 seed lands in the opponent house (index 7)
    const b: Board = [3, 3, 3, 0, 2, 5, 1, 0];
    expect(previewLastSeed(b, selectOpponentHole(b), false).willExtraTurn).toBe(true);
  });

  it('prefers a capture when no extra turn exists', () => {
    // hole 4 with 1 seed lands in empty hole 5; opposite hole 1 has seeds
    const b: Board = [0, 4, 0, 0, 1, 0, 0, 0];
    expect(previewLastSeed(b, selectOpponentHole(b), false).willCapture).toBe(true);
  });

  it('picks a legal hole otherwise', () => {
    const b: Board = [0, 0, 0, 0, 0, 0, 2, 0];
    expect(selectOpponentHole(b, () => 0.5)).toBe(6);
  });

  // Feature: board-scene, Property 5: selectOpponentHole always returns a legal hole
  it('always returns a non-empty opponent hole', () => {
    fc.assert(
      fc.property(boardArb, (b) => {
        fc.pre(hasLegalMove(b, false));
        const h = selectOpponentHole(b);
        expect([4, 5, 6]).toContain(h);
        expect(b[h]).toBeGreaterThan(0);
      }),
    );
  });

  // Feature: board-scene, Property 6: selectOpponentHole prefers extra-turn holes
  it('takes an extra turn whenever one is available', () => {
    fc.assert(
      fc.property(boardArb, (b) => {
        fc.pre(hasLegalMove(b, false));
        const anyExtra = [4, 5, 6].some((h) => b[h] > 0 && previewLastSeed(b, h, false).willExtraTurn);
        fc.pre(anyExtra);
        expect(previewLastSeed(b, selectOpponentHole(b), false).willExtraTurn).toBe(true);
      }),
    );
  });

  // Feature: board-scene, Property 7: selectOpponentHole prefers capture holes when no extra-turn
  it('captures when no extra turn exists but a capture does', () => {
    fc.assert(
      fc.property(boardArb, (b) => {
        const legal = [4, 5, 6].filter((h) => b[h] > 0);
        fc.pre(legal.length > 0);
        const previews = legal.map((h) => previewLastSeed(b, h, false));
        fc.pre(!previews.some((p) => p.willExtraTurn) && previews.some((p) => p.willCapture));
        expect(previewLastSeed(b, selectOpponentHole(b), false).willCapture).toBe(true);
      }),
    );
  });
});

describe('layout helpers', () => {
  it('has 8 positions inside the canvas', () => {
    expect(HOLE_POSITIONS).toHaveLength(8);
    HOLE_POSITIONS.forEach((p) => {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1920);
      expect(p.y).toBeLessThan(1080);
    });
  });
  it('keeps count badges from overlapping each other', () => {
    const pts = [0, 1, 2, 3, 4, 5, 6, 7].map(labelPosition);
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++) expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThan(40);
  });
  it('treats a draw as a loss', () => {
    expect(resultMessage('player')).toBe('You win!');
    expect(resultMessage('opponent')).toBe('You lose.');
    expect(resultMessage('draw')).toBe('You lose.');
  });
});
