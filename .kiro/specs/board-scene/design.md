# Design Document

## Overview

`BoardScene` is the Phaser 3 scene that hosts every playable congkak round in TIPU!. It wraps the existing pure-TypeScript `congkak.ts` logic module and adds a full visual layer: background, opponent portrait, the congkak board with animated seed sprites, interactive hole selection, an opponent AI, and a win/lose overlay.

The same scene class handles both round 1 (indoor room, Wan Mahora, 3 seeds/hole) and round 2 (outdoor night, village chief, 4 seeds/hole). A `RoundConfig` object passed via `scene.start` drives all round-specific behaviour; no branching logic is needed in callers.

Cheat injection, the VHS rewind mechanic, and the tape health system are deliberately out of scope for this spec.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         main.ts                              │
│  Phaser.Game config — registers scenes, starts Boot          │
└────────────────────────┬─────────────────────────────────────┘
                         │ scene.start('BoardScene', RoundConfig)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                      BoardScene.ts                           │
│                                                              │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │  SceneState  │  │  BoardRenderer │  │  AnimationPipeline│ │
│  │  (enum)      │  │  (hole sprites,│  │  (SeedStep[]     │ │
│  │              │  │   seed pool,   │  │   Promise chain) │ │
│  │  PLAYER_TURN │  │   count labels,│  │                  │ │
│  │  OPP_TURN    │  │   glow/preview)│  │                  │ │
│  │  ANIMATING   │  └────────────────┘  └──────────────────┘ │
│  │  GAME_OVER   │                                            │
│  └──────────────┘                                            │
│                                                              │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │  OpponentAI  │  │  GameOverlay   │  │  DemoKeyListener │ │
│  │  (pure fn)   │  │  (container)   │  │  (global, D+1/2) │ │
│  └──────────────┘  └────────────────┘  └──────────────────┘ │
└─────────────────────────────┬────────────────────────────────┘
                              │ pure function calls only
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                   frontend/src/logic/congkak.ts               │
│  makeBoard · applyMove · applyFullMove · getSeedPath          │
│  previewLastSeed · hasLegalMove · getWinner · totalSeeds      │
└──────────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

- All game logic stays in `congkak.ts` with no Phaser imports — the scene only calls pure functions and reacts to their results.
- `BoardScene` is self-contained; it is the only file that imports Phaser in the gameplay layer.
- The animation pipeline is a sequential Promise chain so each `SeedStep` completes before the next begins, keeping the logic straightforward and debuggable.
- The opponent AI is extracted as a standalone pure function (`selectOpponentHole`) that lives inside `BoardScene.ts` but has no Phaser dependencies, making it unit-testable.
- `DemoKeyListener` is a standalone helper (one small function) added to `main.ts` at game creation, so it is active in every scene without each scene registering its own listener.

---

## Components and Interfaces

### RoundConfig

```typescript
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
  seedsPerHole: number;       // always a positive integer
  background: 'room' | 'outside';
  opponent: 'wan_mahora' | 'village_chief';
}
```

`parseRoundConfig(raw: unknown): ResolvedConfig` is a pure helper function exported from `BoardScene.ts` (so it can be unit-tested). It applies defaults:

| raw.round | default seedsPerHole | default background | default opponent |
|-----------|---------------------|--------------------|-----------------|
| 1 or absent/invalid | 3 | 'room' | 'wan_mahora' |
| 2 | 4 | 'outside' | 'village_chief' |

If `raw.seedsPerHole` is provided but is not a positive integer (`> 0` and `Number.isInteger`), it is discarded and the round-derived default is used.

---

### SceneState enum

```typescript
export enum SceneState {
  PLAYER_TURN  = 'PLAYER_TURN',   // awaiting hole click
  OPP_TURN     = 'OPP_TURN',      // opponent AI delay + animation
  ANIMATING    = 'ANIMATING',     // seed animation running (either side)
  GAME_OVER    = 'GAME_OVER',     // overlay shown, only RETRY active
}
```

State transitions:

```
PLAYER_TURN ──(hole clicked)──► ANIMATING ──(animation done)──► OPP_TURN
                                                                    │
                                                               (no legal move)
                                                                    │
OPP_TURN ──(AI selects + animates)──► ANIMATING                    ▼
                                             │              GAME_OVER
                                       (animation done)
                                             │
                                        ┌────┴────┐
                                   extra turn?   no
                                        │         │
                                   OPP_TURN  PLAYER_TURN
```

---

### HoleData

```typescript
export interface HoleData {
  /** Board index (0–7). */
  index: number;
  /** Centre x in base canvas coordinates. */
  x: number;
  /** Centre y in base canvas coordinates. */
  y: number;
  /** Phaser Zone or Image used for pointer interaction (holes 0–6 only). */
  zone: Phaser.GameObjects.Zone;
  /** Text object showing seed count. */
  label: Phaser.GameObjects.Text;
  /** Resting seed sprites currently visible in this hole. */
  restingSeeds: Phaser.GameObjects.Image[];
  /** True when GlowState is active. */
  isGlowing: boolean;
  /** Tweens that form the glow pulse (stored so they can be stopped). */
  glowTweens: Phaser.Tweens.Tween[];
}
```

---

### SeedPool

A lightweight object pool avoids creating/destroying Phaser `Image` objects on every move:

```typescript
interface SeedPool {
  /** Acquire a seed Image from the pool (or create one if empty). */
  acquire(colour: SeedColour): Phaser.GameObjects.Image;
  /** Return a seed Image to the pool (hides it). */
  release(img: Phaser.GameObjects.Image): void;
}
```

All seed images in the pool are added to the scene in `create`; `release` simply calls `setVisible(false)` and `setActive(false)`. This keeps pool management inside `BoardScene` with no global state.

---

### Seed colour constants

```typescript
export const SEED_COLOURS = [
  'black', 'blue', 'green', 'red', 'white', 'yellow',
] as const;
export type SeedColour = typeof SEED_COLOURS[number];

/** Pure helper — exported for unit testing. */
export function getSeedColour(seedIndex: number): SeedColour {
  return SEED_COLOURS[seedIndex % SEED_COLOURS.length];
}
```

---

### OpponentAI

```typescript
/**
 * Pure function — no Phaser imports, fully unit-testable.
 * Returns the hole index the opponent should play this turn.
 */
export function selectOpponentHole(board: Board): number;
```

Algorithm (in priority order):

1. Collect all opponent holes (indices 4, 5, 6) where `board[i] > 0`.
2. Call `previewLastSeed(board, h, false)` for each legal hole.
3. Return first hole where `willExtraTurn === true`.
4. Else return first hole where `willCapture === true`.
5. Else return a uniformly random choice from the remaining legal holes (using `Phaser.Math.RND.pick`; the pure-function version uses `Math.random()` instead, accepting that randomness is not injected).

---

### GameOverlay

```typescript
/**
 * Creates and returns a centred Phaser Container with result text and RETRY button.
 * Layered at depth 100 so it renders above everything else.
 */
function createGameOverlay(
  scene: Phaser.Scene,
  message: 'You win!' | 'You lose.',
  onRetry: () => void,
): Phaser.GameObjects.Container;
```

The container holds:
- A semi-transparent dark rectangle filling ~600×300 px, centred at (960, 540).
- A Phaser Text object with the result message, centred at (960, 490).
- A RETRY button (Text or Image) at (960, 590). Pointer-up fires `onRetry`.

`onRetry` calls `this.scene.restart(this.resolvedConfig)` to re-launch with the same `RoundConfig`.

---

## Data Models

### Board (from congkak.ts)

```
Index: [  0,   1,   2,    3,    4,   5,   6,    7  ]
        p0   p1   p2  pHouse  o0   o1   o2  oHouse
```

The scene holds a single mutable `board: Board` reference that is replaced (not mutated) by every call to `applyFullMove`.

### BoardSceneData

All runtime state for the scene is collected in a single object to make it easy to reason about and reset on RETRY:

```typescript
interface BoardSceneData {
  config: ResolvedConfig;
  board: Board;
  state: SceneState;
  isPlayerTurn: boolean;
  /** How many consecutive opponent extra-turns have fired this sequence. */
  oppExtraTurnCount: number;
}
```

### Hole positions (concrete pixel coordinates)

The board image (`congkak_board.png`) is anchored at (960, 900) in the 1920×1080 canvas. Based on the angled-board artwork, the pit centres are at:

| Index | Role | x | y |
|-------|------|---|---|
| 0 | Player hole 0 (left) | 710 | 890 |
| 1 | Player hole 1 (centre) | 860 | 900 |
| 2 | Player hole 2 (right) | 1010 | 890 |
| 3 | Player house | 1160 | 870 |
| 4 | Opp hole 0 (right) | 1010 | 820 |
| 5 | Opp hole 1 (centre) | 860 | 810 |
| 6 | Opp hole 2 (left) | 710 | 820 |
| 7 | Opp house | 560 | 840 |

> These coordinates are initial design estimates based on the board artwork proportions. During implementation they should be tuned against the actual pixel content of `congkak_board.png`. Store them in a `HOLE_POSITIONS` constant array at the top of `BoardScene.ts` so a single edit updates layout everywhere.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The core game logic in `congkak.ts` is pure TypeScript and amenable to property-based testing. The visual/Phaser layer is not. The properties below target the pure helpers exported from or alongside `BoardScene.ts` (`parseRoundConfig`, `getSeedColour`, `selectOpponentHole`) and the already-proven invariants from `congkak.ts`.

### Property 1: Config parsing always produces valid output

*For any* raw input object (including missing, null, or out-of-range fields), `parseRoundConfig` SHALL return a `ResolvedConfig` where `round` is 1 or 2, `seedsPerHole` is a positive integer, `background` is `'room'` or `'outside'`, and `opponent` is `'wan_mahora'` or `'village_chief'`.

**Validates: Requirements 1.1, 1.7, 1.8**

---

### Property 2: Config parsing preserves valid seedsPerHole overrides

*For any* positive integer `n`, `parseRoundConfig({ round: 1, seedsPerHole: n })` SHALL return a `ResolvedConfig` where `seedsPerHole === n`.

**Validates: Requirements 1.4**

---

### Property 3: Seed colour assignment is cyclic

*For any* non-negative integer `i`, `getSeedColour(i)` SHALL equal `SEED_COLOURS[i % 6]`, and `getSeedColour(i)` SHALL equal `getSeedColour(i + 6)`.

**Validates: Requirements 5.2**

---

### Property 4: getSeedPath steps have strictly increasing seedIndex from zero

*For any* valid board and legal hole index, the `SeedStep[]` returned by `getSeedPath` SHALL have `steps[0].seedIndex === 0` and `steps[k].seedIndex === k` for every index `k`.

**Validates: Requirements 7.1, 7.2**

---

### Property 5: Opponent AI always returns a legal hole

*For any* board state where `hasLegalMove(board, false)` is true, `selectOpponentHole(board)` SHALL return an index in `[4, 5, 6]` where `board[index] > 0`.

**Validates: Requirements 9.2, 9.6**

---

### Property 6: Opponent AI prefers extra-turn holes

*For any* board state where at least one opponent hole produces `willExtraTurn === true` in `previewLastSeed`, `selectOpponentHole(board)` SHALL return a hole index `h` such that `previewLastSeed(board, h, false).willExtraTurn === true`.

**Validates: Requirements 9.3, 9.4**

---

### Property 7: Opponent AI prefers capture holes when no extra-turn available

*For any* board state where no opponent hole produces `willExtraTurn === true` but at least one produces `willCapture === true`, `selectOpponentHole(board)` SHALL return a hole index `h` such that `previewLastSeed(board, h, false).willCapture === true`.

**Validates: Requirements 9.5**

---

## Error Handling

### Invalid RoundConfig

`parseRoundConfig` absorbs all invalid input silently (no throws). It falls back field-by-field: an invalid `round` → defaults to 1; an invalid `seedsPerHole` → derived from resolved `round`; an invalid `background` or `opponent` → derived from resolved `round`.

### applyFullMove / getSeedPath errors

Both functions throw `RangeError` on invalid hole index and `Error` after 200 keep-sow iterations (cycle guard). `BoardScene` wraps the call in a `try/catch`; on any error it logs to `console.error` with the board state and falls through to the game-over overlay with "You lose." so the player can always RETRY.

### Board state invariant mismatch

After every animation completes, `BoardScene` calls `totalSeeds(this.board)` and compares it to the initial seed count. If it differs, `console.error` is called with the board state and expected total; gameplay continues (Requirement 13.5).

### Missing assets

Vite surfaces asset 404s at build time. At runtime, Phaser will log a warning for any missing texture and fall back to a coloured rectangle. No special error handling is needed in `BoardScene`.

---

## Testing Strategy

### Unit tests (`frontend/src/logic/congkak.test.ts` and new `boardScene.helpers.test.ts`)

The existing `congkak.test.ts` already covers `makeBoard`, `applyMove`, `applyFullMove`, `hasLegalMove`, `getWinner`, and all five congkak-rules properties. The new spec adds unit + property tests for the helpers exported from or alongside `BoardScene.ts`:

- `parseRoundConfig` — Properties 1 & 2 (fast-check) + example-based tests for round 1/2 defaults, invalid seedsPerHole, missing fields.
- `getSeedColour` — Property 3 (fast-check) + spot checks.
- `getSeedPath` (already in congkak.ts) — Property 4 (fast-check): for any legal board+hole, `seedIndex` values form a contiguous sequence `0, 1, 2, …`.
- `selectOpponentHole` — Properties 5, 6, 7 (fast-check) using a board arbitrary that ensures at least one legal opponent hole exists.

All property tests use **fast-check** at a minimum of **100 iterations** each and are tagged with the design property they validate.

### Integration / manual tests

The following aspects require manual or visual verification:

- Background fills 1920×1080 without letterboxing/pillarboxing (Requirement 3.1).
- Hole zone click targets align with the visible pit areas of `congkak_board.png` (Requirements 3.4–3.7).
- GlowState pulse is visible and removed correctly on each state transition (Requirement 6).
- Seed arc animations play at the correct speed and hand sprite swaps correctly (Requirement 7).
- Opponent portrait never receives `setTint` calls (Requirement 10.5).
- `GameOverlay` appears above all other objects and RETRY restarts correctly (Requirement 11).
- Demo key sequence `D`+`1` and `D`+`2` jump to the correct rounds from any scene (Requirement 12).

### Property test file location and tag format

File: `frontend/src/scenes/boardScene.helpers.test.ts`

Each property test is tagged with a comment:
```typescript
// Feature: board-scene, Property N: <property text>
```

### What is explicitly not tested

- Phaser scene lifecycle methods (`preload`, `create`, `update`) — too tightly coupled to the Phaser renderer.
- Animation timing (arc duration 150–400 ms, pause 100–300 ms) — verified by play-testing.
- VHS effects, tint, and alpha — out of scope for this spec.
