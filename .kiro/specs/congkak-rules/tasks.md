# Implementation Plan: Congkak Rules

## Overview

Extend `frontend/src/logic/congkak.ts` with symmetrical opponent-side sowing, keep-sowing resolution, full-turn move application, per-seed animation paths, a last-seed preview helper, and winner determination. Update `frontend/src/logic/congkak.test.ts` to cover all new behaviour with unit tests and fast-check properties. All code is pure TypeScript with no Phaser imports.

## Tasks

- [x] 1. Refactor sowing primitives and types in `congkak.ts`
  - [x] 1.1 Replace `nextIndex(i)` with `nextIndexFor(i, isPlayer)` that skips index 7 when `isPlayer` is `true` and skips index 3 when `isPlayer` is `false`
    - Remove the old `nextIndex` function; keep its logic as the `isPlayer: true` branch
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 1.2 Replace `sowingPath(fromHole, count)` with `sowingPathFor(fromHole, count, isPlayer)` that delegates to `nextIndexFor`
    - Remove the old `sowingPath` function
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 1.3 Add `validateHole(board, holeIndex, isPlayer)` guard that throws `RangeError` when the hole is empty, not in the mover's valid hole set, or outside 0–6
    - _Requirements: 3.8, 4.6, 6.6_
  - [x] 1.4 Update the `MoveResult` interface to add `nextHole: number`
    - _Requirements: 3.3_

- [x] 2. Update `applyMove` to support both sides
  - [x] 2.1 Add `isPlayer: boolean` parameter; call `sowingPathFor` and `validateHole` with it; evaluate extra-turn against the mover's house and tembak against the mover's side holes
    - Preserve all existing player-side behaviour; the existing tests will be updated in task 3 to pass `true`
    - Return `nextHole` in every `MoveResult` (set to `lastIdx`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 8.1_
  - [ ]* 2.2 Write unit tests for opponent `applyMove` (skips index 3, extra turn at index 7, tembak into index 7, no-capture empty-opposite, empty-opponent-hole terminal)
    - _Requirements: 10.16_

- [x] 3. Update existing tests to pass `isPlayer: true`
  - [x] 3.1 In `congkak.test.ts`, add `isPlayer: true` to every existing `applyMove(b, holeIndex)` call so they compile and pass with the updated signature
    - No logic changes; existing assertions must continue to pass
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

- [x] 4. Add `applyFullMove`
  - [x] 4.1 Export `FullMoveResult` interface (`board`, `extraTurn`, `captured`, `captureHole?`)
    - _Requirements: 4.1_
  - [x] 4.2 Implement `applyFullMove(board, holeIndex, isPlayer)`: call `applyMove` in a loop using `nextHole`, continuing while `!extraTurn && !captured && board[nextHole] > 1`; throw `Error` after 200 iterations; call `validateHole` before the loop
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.2_
  - [ ]* 4.3 Write unit tests for `applyFullMove`: two-step keep-sowing chain, extra-turn resolution, tembak resolution, opponent full move with keep-sowing, empty-hole RangeError, cycle-guard Error
    - _Requirements: 10.9, 10.17_
  - [ ]* 4.4 Write property test — Property 6: `applyFullMove` preserves total seed count for both `isPlayer: true` and `isPlayer: false`
    - **Property 6: applyFullMove preserves total seed count for both sides**
    - **Validates: Requirements 4.4, 8.3, 9.3, 9.4**

- [x] 5. Add `getWinner`
  - [x] 5.1 Export `GameResult` type (`'player' | 'opponent' | 'draw'`) and implement `getWinner(board)` returning the correct value based on house comparison
    - _Requirements: 7.3, 7.4_
  - [ ]* 5.2 Write unit tests for `getWinner`: player wins, opponent wins, draw
    - _Requirements: 10.12_
  - [ ]* 5.3 Write property test — Property 9: `getWinner` correctly compares house counts
    - **Property 9: getWinner correctly compares house counts**
    - **Validates: Requirements 7.3**

- [ ] 6. Checkpoint — ensure all existing and new tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Add `getSeedPath`
  - [x] 7.1 Export `SeedStepType` and `SeedStep` types
    - _Requirements: 5.1_
  - [x] 7.2 Implement `getSeedPath(board, holeIndex, isPlayer)`: maintain an internal board copy; emit `SeedStep` records with sequentially assigned `seedIndex` values for `'sow'`, `'keepSowing'`, `'extraTurn'`, and `'tembak'` types following the algorithm in the design; throw `Error` after 200 iterations
    - Tembak emits: landing seed (`fromHole=landingHole, toHole=moverHouse, type='tembak'`) then one step per captured seed (`fromHole=oppositeHole, toHole=moverHouse, type='tembak'`)
    - Extra turn emits a final step (`fromHole=lastSlot, toHole=moverHouse, type='extraTurn'`)
    - Keep-sowing emits a transition step (`fromHole=landingHole, toHole=landingHole, type='keepSowing'`) before resuming `'sow'` steps
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 7.3 Write unit tests for `getSeedPath`: verify exact `SeedStep` sequence (seedIndex, fromHole, toHole, type) for a known board including tembak path, extra-turn path, and keep-sowing path
    - _Requirements: 10.13_
  - [ ]* 7.4 Write property test — Property 12: `getSeedPath` seedIndex values are unique and sequential
    - **Property 12: getSeedPath seedIndex values are unique and sequential**
    - **Validates: Requirements 5.6**

- [x] 8. Add `previewLastSeed`
  - [x] 8.1 Export `PreviewResult` interface (`landingHole`, `willCapture`, `willExtraTurn`, `willKeepSow`)
    - _Requirements: 6.1_
  - [x] 8.2 Implement `previewLastSeed(board, holeIndex, isPlayer)`: copy the board with `[...board] as Board`, call `applyFullMove` on the copy, derive the four `PreviewResult` fields from the `FullMoveResult`, and return without touching the original board
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 8.3 Write unit tests for `previewLastSeed`: `willCapture: true` for a known tembak board, `willExtraTurn: true` for a known extra-turn board, input board is not mutated (check every element), RangeError on empty hole
    - _Requirements: 10.14, 10.15_
  - [ ]* 8.4 Write property test — Property 7: `previewLastSeed` agrees with `applyFullMove`
    - **Property 7: previewLastSeed agrees with applyFullMove**
    - **Validates: Requirements 6.4, 6.5, 11.5**
  - [ ]* 8.5 Write property test — Property 8: `previewLastSeed` does not mutate the input board
    - **Property 8: previewLastSeed does not mutate the input board**
    - **Validates: Requirements 6.3**

- [x] 9. Add missing fast-check properties to `congkak.test.ts`
  - [x]* 9.1 Write property test — Property 1: `makeBoard` houses are always zero
    - **Property 1: makeBoard houses are always zero**
    - **Validates: Requirements 1.5**
  - [x]* 9.2 Write property test — Property 2: `makeBoard` total seeds equals `seedsPerHole × 6`
    - **Property 2: makeBoard total seeds equals seedsPerHole × 6**
    - **Validates: Requirements 1.6**
  - [x]* 9.3 Write property test — Property 3: player sowing never deposits in opponent's house
    - **Property 3: Player sowing never deposits in opponent's house**
    - **Validates: Requirements 2.3**
  - [x]* 9.4 Write property test — Property 4: opponent sowing never deposits in player's house
    - **Property 4: Opponent sowing never deposits in player's house**
    - **Validates: Requirements 2.4**
  - [x]* 9.5 Write property test — Property 5: `applyMove` preserves total seed count (update existing property to pass `isPlayer: true`)
    - **Property 5: applyMove preserves total seed count**
    - **Validates: Requirements 9.2**
  - [x]* 9.6 Write property test — Property 10: complete game from `makeBoard(3)` terminates within 500 turns
    - **Property 10: Complete game from round-1 board terminates**
    - **Validates: Requirements 11.3**
  - [x]* 9.7 Write property test — Property 11: complete game from `makeBoard(4)` terminates within 500 turns
    - **Property 11: Complete game from round-2 board terminates**
    - **Validates: Requirements 11.4**

- [ ] 10. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests must be tagged: `Feature: congkak-rules, Property N: <name>` per the design
- The existing fast-check `totalSeeds invariant` test covers Property 5 for player moves only; task 9.5 updates it to pass `isPlayer: true` and task 4.4 extends coverage to `applyFullMove` and the opponent side
- `previewLastSeed` intentionally calls `applyFullMove` internally — no separate traversal logic needed
- Run tests with `cd frontend && npm run test` (Vitest run mode, not watch)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["4.3", "4.4", "5.2", "5.3"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2"] },
    { "id": 8, "tasks": ["7.3", "7.4", "8.1"] },
    { "id": 9, "tasks": ["8.2"] },
    { "id": 10, "tasks": ["8.3", "8.4", "8.5", "9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 11, "tasks": ["9.6", "9.7"] }
  ]
}
```
