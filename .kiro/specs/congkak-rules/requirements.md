# Requirements Document

## Introduction

This spec covers the pure TypeScript congkak game logic module at `frontend/src/logic/congkak.ts`. The module implements the rules of mini congkak (3 holes + 1 house per side) as used in TIPU!, plus two new functions required by the animation/replay system and the UI hint layer. It has no Phaser imports and must be fully unit-testable in Vitest with fast-check property tests.

A first version of the module already exists. This spec documents the complete intended behaviour, including gaps that must be filled: full multi-step move resolution, per-seed animation paths, a last-seed preview, opponent-side move application, game-end detection, and winner determination.

## Glossary

- **Board**: An 8-element numeric tuple `[p0, p1, p2, playerHouse, o0, o1, o2, oppHouse]` where indices 0–2 are the player's holes, index 3 is the player's house, indices 4–6 are the opponent's holes, and index 7 is the opponent's house.
- **CongkakLogic**: The pure TypeScript module (`congkak.ts`) that owns all game-rule functions.
- **Player**: Mahsuri; always moves first; occupies holes 0–2 and house 3.
- **Opponent**: The NPC (Wan Mahora or the village chief); occupies holes 4–6 and house 7.
- **Hole**: Any of the six non-house slots (indices 0–2 for the player, 4–6 for the opponent).
- **House**: The scoring slot for each side (index 3 for the player, index 7 for the opponent).
- **Sowing**: Distributing seeds one per slot anticlockwise, including the mover's own house, skipping the opponent's house.
- **Anticlockwise order**: Starting one step after the picked hole, the sequence advances through indices 0→1→2→3→4→5→6→0→… where index 7 (opponent house) is always skipped when the player moves, and index 3 (player house) is always skipped when the opponent moves.
- **Extra turn**: The right to move again immediately, granted when the last sown seed lands in the mover's own house.
- **Keep-sowing**: When the last sown seed lands in a non-empty hole, the mover picks up all seeds from that hole and continues sowing without ending the turn.
- **Tembak**: A capture triggered when the last sown seed lands in an empty hole on the mover's own side that has a non-empty opposite hole; the landing seed plus all seeds in the opposite hole are moved to the mover's house and the turn ends.
- **Opposite hole**: The hole directly across the board: player hole 0 ↔ opponent hole 6, player hole 1 ↔ opponent hole 5, player hole 2 ↔ opponent hole 4.
- **Legal move**: Picking up seeds from any non-empty hole belonging to the current mover and sowing them.
- **MoveResult**: The return type of `applyMove` — contains the updated board, `extraTurn` flag, `captured` flag, optional `captureHole` index, and `nextHole` (the landing hole, used to continue keep-sowing).
- **FullMoveResult**: The return type of `applyFullMove` — the fully resolved board after all keep-sowing continuations, plus `extraTurn`, `captured`, and optional `captureHole` flags.
- **SeedStep**: One atomic event in a `getSeedPath` result — records `seedIndex` (zero-based, sequential across the full turn), `fromHole`, `toHole`, and `type` (`'sow' | 'extraTurn' | 'tembak' | 'keepSowing'`).
- **PreviewResult**: The return type of `previewLastSeed` — `{ landingHole: number; willCapture: boolean; willExtraTurn: boolean; willKeepSow: boolean }`.
- **GameResult**: The union type `'player' | 'opponent' | 'draw'` returned by `getWinner`.
- **Round 1**: Game starts with 3 seeds per hole (18 seeds total).
- **Round 2**: Game starts with 4 seeds per hole (24 seeds total).
- **Draw**: Equal house counts at game end; treated as a loss for the player (round restarts).
- **Vitest**: The unit-test runner used in this project.
- **fast-check**: The property-based testing library used in this project.

---

## Requirements

### Requirement 1: Board Representation and Initialisation

**User Story:** As a developer, I want a canonical board type and a factory function, so that every part of the codebase uses the same structure and starting state.

#### Acceptance Criteria

1. THE CongkakLogic module SHALL export a `Board` type that is an 8-element numeric tuple indexed as `[p0, p1, p2, playerHouse, o0, o1, o2, oppHouse]`.
2. THE CongkakLogic module SHALL export named constants `PLAYER_HOLES` (`[0, 1, 2]`), `PLAYER_HOUSE` (`3`), `OPP_HOLES` (`[4, 5, 6]`), and `OPP_HOUSE` (`7`).
3. WHEN `makeBoard(seedsPerHole)` is called with `3`, THE CongkakLogic module SHALL return a Board where each of the six holes (indices 0–2 and 4–6) contains exactly 3 seeds and both houses (indices 3 and 7) contain exactly 0, yielding a total seed count of exactly 18.
4. WHEN `makeBoard(seedsPerHole)` is called with `4`, THE CongkakLogic module SHALL return a Board where each of the six holes (indices 0–2 and 4–6) contains exactly 4 seeds and both houses (indices 3 and 7) contain exactly 0, yielding a total seed count of exactly 24.
5. THE `makeBoard` function SHALL return a Board where both houses (`board[3]` and `board[7]`) are exactly 0 regardless of the `seedsPerHole` argument.
6. THE sum of all 8 elements of the Board returned by `makeBoard(seedsPerHole)` SHALL equal `seedsPerHole × 6`.

---

### Requirement 2: Anticlockwise Sowing Order

**User Story:** As a developer, I want the sowing logic to follow the correct anticlockwise order, so that the game rules are enforced accurately.

#### Acceptance Criteria

1. WHEN seeds are sown by the player, THE CongkakLogic module SHALL place one seed per slot in anticlockwise order starting one step after the picked hole: the sequence advances through indices 0→1→2→3→4→5→6→0→… wrapping back to 0 after index 6, skipping index 7 on every pass.
2. WHEN seeds are sown, THE CongkakLogic module SHALL include the mover's own house in the sowing path (index 3 for the player, index 7 for the opponent).
3. WHEN seeds are sown by the player, THE CongkakLogic module SHALL skip index 7 (opponent's house) and never place a seed there.
4. WHEN seeds are sown by the opponent, THE CongkakLogic module SHALL skip index 3 (player's house) and never place a seed there; the opponent's anticlockwise path is 4→5→6→7→0→1→2→4→… skipping index 3 on every pass.
5. WHEN a sowing pass requires more seeds than there are remaining slots before wrapping, THE CongkakLogic module SHALL continue the anticlockwise cycle from the beginning of the sequence, placing seeds across multiple laps until all seeds are distributed, so that no seed is ever lost or created.

---

### Requirement 3: Single-Step Move Application (`applyMove`)

**User Story:** As a developer, I want an `applyMove` function that resolves one sowing pass, so that the animation system can drive each step independently.

#### Acceptance Criteria

1. WHEN `applyMove(board, holeIndex, isPlayer)` is called, THE CongkakLogic module SHALL remove all seeds from `board[holeIndex]`, set `board[holeIndex]` to 0, and sow them one per slot in anticlockwise order starting one step after `holeIndex`, following the sequence defined in Requirement 2.
2. WHEN the last sown seed lands in the mover's own house, THE CongkakLogic module SHALL return a `MoveResult` with `extraTurn: true`, `captured: false`, and `nextHole` equal to the mover's house index.
3. WHEN the last sown seed lands in a non-empty hole (after incrementing that hole by 1), THE CongkakLogic module SHALL return a `MoveResult` with `extraTurn: false`, `captured: false`, and `nextHole` equal to that hole's index, signalling that the caller must invoke `applyMove` again from `nextHole` to continue keep-sowing.
4. WHEN the last sown seed lands in an empty hole on the mover's own side (the hole had 0 seeds before the increment, so `board[lastIdx] === 1` after sowing) and the opposite hole is non-empty, THE CongkakLogic module SHALL perform a tembak capture: add `board[oppositeHole] + 1` to the mover's house, set both the landing hole and the opposite hole to 0, and return a `MoveResult` with `captured: true`, `captureHole` set to the opposite hole index, and `extraTurn: false`.
5. WHEN the last sown seed lands in an empty hole on the mover's own side and the opposite hole is also empty, THE CongkakLogic module SHALL return a `MoveResult` with `captured: false` and `extraTurn: false` (turn ends, no capture).
6. WHEN the last sown seed lands in an empty hole on the opponent's side, THE CongkakLogic module SHALL return a `MoveResult` with `extraTurn: false` and `captured: false` (turn ends, no capture).
7. WHEN `applyMove` is called with `isPlayer: false`, THE CongkakLogic module SHALL apply the same rules from the opponent's perspective: the opponent's house is index 7, tembak evaluates opponent holes 4–6 and their opposites (4↔2, 5↔1, 6↔0), and the mover's "own side" means indices 4–6.
8. IF `applyMove` is called with `board[holeIndex] === 0` or `holeIndex` outside the range 0–6, THEN THE CongkakLogic module SHALL throw a `RangeError` without modifying the board.

---

### Requirement 4: Full Multi-Step Move Resolution (`applyFullMove`)

**User Story:** As a developer, I want an `applyFullMove` function that drives all keep-sowing continuations to completion, so that the board state after a complete turn can be computed in one call.

#### Acceptance Criteria

1. THE CongkakLogic module SHALL export an `applyFullMove(board, holeIndex, isPlayer)` function that calls `applyMove` repeatedly — using the `nextHole` from each result as the next `holeIndex` — until the result is not a keep-sowing signal (i.e., until `extraTurn` is true, `captured` is true, or the last seed lands in an empty hole or the opponent's side), and returns a `FullMoveResult` containing the final `board`, `extraTurn` flag, `captured` flag, and optional `captureHole`.
2. WHEN `applyFullMove` resolves to an extra turn, THE CongkakLogic module SHALL return a `FullMoveResult` with `extraTurn: true`.
3. WHEN `applyFullMove` resolves to a tembak, THE CongkakLogic module SHALL return a `FullMoveResult` with `captured: true` and `captureHole` set to the captured hole index.
4. THE total seed count of the board field in the `FullMoveResult` returned by `applyFullMove` SHALL equal the total seed count of the input board.
5. IF the keep-sowing chain has not terminated after 200 iterations, THEN THE CongkakLogic module SHALL throw an error indicating that an infinite-loop cycle guard was triggered.
6. IF `applyFullMove` is called with `board[holeIndex] === 0`, a hole that does not belong to the mover's side, or `holeIndex` outside 0–6, THEN THE CongkakLogic module SHALL throw a `RangeError` without modifying the board.

---

### Requirement 5: Seed-Path Export for Animation and Replay (`getSeedPath`)

**User Story:** As a developer, I want a function that returns every seed's movement as an ordered list of steps, so that the animation and VHS replay systems can drive each seed individually.

#### Acceptance Criteria

1. THE CongkakLogic module SHALL export a `SeedStep` type with fields: `seedIndex` (number, zero-based index assigned sequentially in sowing order across the full turn), `fromHole` (number, the slot the seed departed), `toHole` (number, the slot the seed arrived at), and `type` (`'sow' | 'extraTurn' | 'tembak' | 'keepSowing'`).
2. WHEN `getSeedPath(board, holeIndex, isPlayer)` is called, THE CongkakLogic module SHALL return a `SeedStep[]` in chronological sowing order that enumerates every seed movement for the complete turn — using the sowing perspective of `isPlayer` (player holes 0–2, house 3 when `true`; opponent holes 4–6, house 7 when `false`) — including all keep-sowing continuations.
3. WHEN a tembak capture occurs, THE CongkakLogic module SHALL append one `SeedStep` of type `'tembak'` per seed moved to the mover's house: the landing seed's step has `fromHole` equal to the landing hole and `toHole` equal to the mover's house; each captured seed from the opposite hole has `fromHole` equal to the opposite hole index and `toHole` equal to the mover's house.
4. WHEN an extra turn is granted, THE CongkakLogic module SHALL append a final `SeedStep` of type `'extraTurn'` where `fromHole` is the last sowing source slot and `toHole` is the mover's house index (3 for the player, 7 for the opponent).
5. WHEN a keep-sowing continuation begins, THE CongkakLogic module SHALL append a `SeedStep` of type `'keepSowing'` immediately after the last `'sow'` step for that sowing pass, where both `fromHole` and `toHole` equal the landing hole index (the hole whose seeds are picked up to continue), before any `'sow'` steps for the next pass.
6. THE count of unique `seedIndex` values in the returned `SeedStep[]` SHALL equal the total number of seeds that moved during the full turn; specifically, that count equals the seeds picked up at the initial hole plus any additional seeds picked up during keep-sowing continuations, with no duplicates or omissions.

---

### Requirement 6: Last-Seed Preview for UI Hints (`previewLastSeed`)

**User Story:** As a developer, I want a pure function that predicts where the last seed lands without mutating the board, so that the UI can highlight outcomes before the player commits to a move.

#### Acceptance Criteria

1. THE CongkakLogic module SHALL export a `PreviewResult` type with fields: `landingHole` (number), `willCapture` (boolean), `willExtraTurn` (boolean), and `willKeepSow` (boolean).
2. WHEN `previewLastSeed(board, holeIndex, isPlayer)` is called, THE CongkakLogic module SHALL follow the same keep-sowing chain as `applyFullMove` — continuing until the last seed lands in a house, an empty hole with no further keep-sowing, or triggers a capture — and return a `PreviewResult` describing that final outcome.
3. WHEN `previewLastSeed` is called, each element of the input `board` array SHALL equal its pre-call value after the function returns (the function is pure and must not mutate the input).
4. IF `previewLastSeed` is called with a valid board and a non-empty hole belonging to the specified mover, THEN `landingHole` SHALL equal the index of the hole where `applyFullMove` places the last seed for the same input.
5. IF `previewLastSeed` is called with a valid board and a non-empty hole belonging to the specified mover, THEN `willCapture`, `willExtraTurn`, and `willKeepSow` SHALL each match the corresponding flag in the `FullMoveResult` returned by `applyFullMove` for the same input.
6. IF `previewLastSeed` is called with `board[holeIndex] === 0`, a hole that does not belong to the specified mover, or `holeIndex` outside 0–6, THEN THE CongkakLogic module SHALL throw a `RangeError`.

---

### Requirement 7: Game-End Detection and Winner Determination

**User Story:** As a developer, I want functions that detect when the game is over and determine the winner, so that the scene can trigger the correct outcome (retry or advance).

#### Acceptance Criteria

1. THE CongkakLogic module SHALL export a `hasLegalMove(board, isPlayer)` function that returns `true` when the specified side has at least one non-empty hole among its play holes (indices 0–2 for the player when `isPlayer` is `true`; indices 4–6 for the opponent when `isPlayer` is `false`), and `false` otherwise.
2. WHEN `hasLegalMove(board, isCurrentMoverIsPlayer)` returns `false`, THE CongkakLogic module SHALL expose this as the game-ended condition, where `isCurrentMoverIsPlayer` is `true` if it is the player's turn and `false` if it is the opponent's turn.
3. THE CongkakLogic module SHALL export a `getWinner(board)` function that accepts the 8-element board array and returns a `GameResult` value of `'player'` when `board[3] > board[7]`, `'opponent'` when `board[7] > board[3]`, and `'draw'` when `board[3] === board[7]`, where `GameResult` is the union type `'player' | 'opponent' | 'draw'`.
4. WHEN `getWinner(board)` returns `'draw'`, THE CongkakLogic module SHALL return the `'draw'` value unchanged; the interpretation of a draw as a loss is the responsibility of the calling scene.
5. IF `getWinner(board)` returns `'opponent'` or `'draw'`, THEN the scene SHALL restart the current round from its initial seed distribution, without transitioning to the next scene.

---

### Requirement 8: Opponent-Side Move Application

**User Story:** As a developer, I want `applyMove` and `applyFullMove` to handle opponent moves with the same rules, so that the AI opponent can be driven by the same logic module.

#### Acceptance Criteria

1. WHEN `applyMove(board, holeIndex, isPlayer)` is called with `isPlayer: false`, THE CongkakLogic module SHALL pick up seeds from `board[holeIndex]` (where `holeIndex` is one of 4, 5, or 6), sow anticlockwise through indices 4→5→6→7→0→1→2→4→… (skipping index 3), evaluate extra-turn on landing at index 7, and evaluate tembak on landing in an empty opponent hole (4, 5, or 6) with a non-empty opposite player hole (2, 1, or 0 respectively), capturing into index 7.
2. WHEN `applyFullMove(board, holeIndex, isPlayer)` is called with `isPlayer: false`, THE CongkakLogic module SHALL resolve all keep-sowing continuations from the opponent's perspective, terminating on extra turn (landing at 7), tembak, or a terminal empty-hole landing, using the same 200-iteration cycle guard.
3. THE total seed count of the board SHALL be preserved by all opponent moves: `totalSeeds(applyFullMove(board, holeIndex, false).board) === totalSeeds(board)` for any valid opponent move.

---

### Requirement 9: Seed-Count Invariant

**User Story:** As a developer, I want the seed-count invariant to be verified by property tests, so that regressions in the sowing logic are caught automatically.

#### Acceptance Criteria

1. THE CongkakLogic module SHALL export a `totalSeeds(board)` function that returns the sum of all 8 elements of the Board.
2. THE seed count returned by `totalSeeds` SHALL be unchanged after any call to `applyMove` on a board where the chosen hole is non-empty: `totalSeeds(applyMove(board, holeIndex, isPlayer).board) === totalSeeds(board)`.
3. THE CongkakLogic module SHALL export `applyFullMove`; the seed count returned by `totalSeeds` SHALL be unchanged after any call to `applyFullMove` on a board where the chosen hole is non-empty and belongs to the mover's side: `totalSeeds(applyFullMove(board, holeIndex, isPlayer).board) === totalSeeds(board)`.
4. THE seed count SHALL be unchanged for opponent moves: `totalSeeds(applyFullMove(board, holeIndex, false).board) === totalSeeds(board)` for any valid opponent move.

---

### Requirement 10: Unit Tests — Complete Rule Coverage

**User Story:** As a developer, I want a Vitest unit-test suite that covers every stated rule, so that any future change to the logic is immediately caught.

#### Acceptance Criteria

1. THE test suite SHALL include a test verifying that `makeBoard(3)` returns a board with total seeds equal to 18 and both houses equal to 0.
2. THE test suite SHALL include a test verifying that `makeBoard(4)` returns a board with total seeds equal to 24 and both houses equal to 0.
3. THE test suite SHALL include a test verifying that `applyMove` sets `board[holeIndex]` to 0 and distributes all seeds from that hole into subsequent slots.
4. THE test suite SHALL include a test verifying that `applyMove` returns `extraTurn: true` when the last seed lands exactly in the player's house (index 3).
5. THE test suite SHALL include a test verifying that `applyMove` returns `extraTurn: false`, `captured: false`, and a `nextHole` equal to the landing hole when the last seed lands in a non-empty hole (keep-sowing signal).
6. THE test suite SHALL include a test verifying that tembak capture adds the landing seed plus all seeds from the opposite hole to the mover's house and sets both the landing hole and the opposite hole to 0.
7. THE test suite SHALL include a test verifying that no capture occurs (and `captured: false` is returned) when the last seed lands in an empty player hole whose opposite hole is also empty.
8. THE test suite SHALL include a test verifying that the turn ends with `extraTurn: false` and `captured: false` when the last seed lands in an empty opponent hole.
9. THE test suite SHALL include a test verifying that `applyFullMove` drives all keep-sowing continuations and returns the correct final board and terminal outcome flags.
10. THE test suite SHALL include a test verifying that `hasLegalMove` returns `false` when all holes on one side are 0.
11. THE test suite SHALL include a test verifying that `hasLegalMove` returns `true` when at least one hole on a side is non-zero.
12. THE test suite SHALL include a test verifying that `getWinner` returns `'player'` when `board[3] > board[7]`, `'opponent'` when `board[7] > board[3]`, and `'draw'` when both are equal.
13. THE test suite SHALL include a test verifying that `getSeedPath` returns the correct ordered sequence of `SeedStep` entries — with accurate `seedIndex`, `fromHole`, `toHole`, and `type` values — including keep-sowing transitions, for a known hand-crafted board state.
14. THE test suite SHALL include a test verifying that `previewLastSeed` returns `willCapture: true` for a board where tembak is known to occur.
15. THE test suite SHALL include a test verifying that `previewLastSeed` returns `willExtraTurn: true` for a board where the last seed is known to land in the mover's house.
16. THE test suite SHALL include tests verifying that `applyMove` with `isPlayer: false` sows correctly from opponent holes, skips index 3, and triggers tembak into index 7.
17. THE test suite SHALL include a test verifying that `applyFullMove` with `isPlayer: false` resolves keep-sowing continuations from the opponent's perspective and preserves total seed count.

---

### Requirement 11: Property-Based Tests with fast-check

**User Story:** As a developer, I want fast-check property tests that cover invariants and termination, so that edge cases in the sowing logic are systematically explored.

#### Acceptance Criteria

1. THE test suite SHALL include a fast-check property verifying that `totalSeeds` is unchanged after any call to `applyMove(board, holeIndex, true)` where `board[holeIndex] > 0` and `holeIndex` is in `[0, 1, 2]`.
2. THE test suite SHALL include a fast-check property verifying that `totalSeeds` is unchanged after any call to `applyFullMove(board, holeIndex, isPlayer)` where `isPlayer` is `true` or `false` and the chosen hole is non-empty and belongs to the mover's side.
3. THE test suite SHALL include a fast-check property verifying that simulating a complete game from `makeBoard(3)` — alternating `applyFullMove` for player and opponent, stopping when `hasLegalMove` returns `false` for the side to move — always terminates within 500 full turns.
4. THE test suite SHALL include a fast-check property verifying that simulating a complete game from `makeBoard(4)` terminates within 500 full turns using the same strategy as criterion 3.
5. THE test suite SHALL include a fast-check property verifying that for any valid board and non-empty mover hole, `previewLastSeed(board, holeIndex, isPlayer).landingHole` equals the `nextHole` (or final landing hole) produced by `applyFullMove(board, holeIndex, isPlayer)` for the same inputs.
