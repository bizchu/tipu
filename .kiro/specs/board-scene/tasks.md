# Implementation Plan: Board Scene

## Overview

Build `BoardScene.ts`, the Phaser 3 scene that hosts every playable congkak round in TIPU!. The work proceeds in a layered build-up: types and config parsing → asset loading → layout → seed count labels → seed sprites and pool → glow/preview interaction → animation pipeline → turn state machine → opponent AI → portrait reactions → game-end overlay → demo key listener → property and unit tests → wiring into `main.ts` → build verification. All game logic stays in the existing `congkak.ts`; this scene only calls pure functions and reacts to their results.

## Tasks

- [x] 1. Define exported types, constants, and pure helper `parseRoundConfig` in `BoardScene.ts`
  - [x] 1.1 Create `frontend/src/scenes/BoardScene.ts`; export `RoundConfig`, `ResolvedConfig`, `SceneState` enum, `SEED_COLOURS`, `SeedColour`, `HoleData`, and `HOLE_POSITIONS` constant array with the eight pixel-coordinate pairs from the design
    - Interfaces and the enum have no Phaser dependency and can be exported at module level
    - `HOLE_POSITIONS` must be a `const` array so a single edit updates layout everywhere
    - _Requirements: 1.1, 3.3–3.7_
  - [x] 1.2 Implement and export `parseRoundConfig(raw: unknown): ResolvedConfig`; apply round-derived defaults for missing/invalid fields; discard `seedsPerHole` if it is not a positive integer
    - `parseRoundConfig` is a pure function with no Phaser imports — it can be imported directly by the test file
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.8_
  - [x] 1.3 Implement and export `getSeedColour(seedIndex: number): SeedColour` using `SEED_COLOURS[seedIndex % SEED_COLOURS.length]`
    - _Requirements: 5.2_
  - [x] 1.4 Implement and export `selectOpponentHole(board: Board): number`; priority order: extra-turn hole → capture hole → random legal hole; use `Math.random()` (not `Phaser.Math.RND`) so the function remains free of Phaser imports
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 2. Implement `preload` — declare and load all required assets
  - [x] 2.1 In `BoardScene.preload`, load background images for both `'room'` (`backgrounds/room/room_preview.png` → key `bg_room`) and `'outside'` (`backgrounds/outside/outside_preview.png` → key `bg_outside`)
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Load all three Wan Mahora portrait frames (`characters/wan_mahora/wan_mahora_calm.png`, `wan_mahora_annoyed.png`, `wan_mahora_angry.png`)
    - _Requirements: 2.3_
  - [x] 2.3 Load all four village chief portrait frames (`characters/village_chief/village_chief_calm.png`, `village_chief_angry.png`, `village_chief_dead.png`, `village_chief_dead_grey.png`)
    - _Requirements: 2.4_
  - [x] 2.4 Load both board images (`board/congkak_board.png` → key `board_angled`, `board/congkak_board_flat.png` → key `board_flat`) and the gameplay textbox (`ui/textbox_gameplay.png` → key `textbox_gameplay`)
    - _Requirements: 2.5, 2.8_
  - [x] 2.5 Load all six seed images (`board/seeds/seed_black.png`, `seed_blue.png`, `seed_green.png`, `seed_red.png`, `seed_white.png`, `seed_yellow.png`) with keys `seed_<colour>`
    - _Requirements: 2.6_
  - [x] 2.6 Load all five hand images (`ui/hands/hand_fist.png`, `hand_open.png`, `hand_claw.png`, `hand_grab.png`, `hand_reach.png`) with keys `hand_<name>`
    - _Requirements: 2.7_

- [x] 3. Implement `create` — background, board image, opponent portrait, and textbox layout
  - [x] 3.1 Place the background image (key selected from `resolvedConfig.background`) scaled to fill 1920×1080 at depth 0; place `board_angled` centred at (960, 900) at depth 10
    - _Requirements: 3.1, 3.3_
  - [x] 3.2 Place the opponent portrait (calm pose) centred at (960, 350) at depth 5, behind the board; store the reference so pose can be swapped later
    - Portrait sprite must never receive `setTint` or have `alpha` modified
    - _Requirements: 3.2, 10.1, 10.5_
  - [x] 3.3 Create a `Phaser.GameObjects.Zone` for each of the eight holes at the coordinates in `HOLE_POSITIONS`; store all eight in the `holes: HoleData[]` array; zones for the houses (indices 3 and 7) are non-interactive
    - _Requirements: 3.4, 3.5, 3.6, 3.7_
  - [x] 3.4 Place the gameplay textbox image with its left edge at x = 40 and top edge at y = 740 at depth 20
    - _Requirements: 3.8_

- [x] 4. Implement seed count labels (Requirement 4)
  - [x] 4.1 For each entry in `holes`, create a `Phaser.GameObjects.Text` label centred above the hole's (x, y), depth 30; initialise with `String(board[index])` and store it in `holeData.label`
    - _Requirements: 4.1, 4.2_
  - [x] 4.2 Implement `updateLabels(board: Board)` — a private method that iterates all eight `HoleData` entries and sets `label.setText(String(board[i]))`; call it at the start of every move before any animation
    - _Requirements: 4.3, 4.4_

- [x] 5. Implement `SeedPool` and resting seed sprites (Requirement 5)
  - [x] 5.1 Implement a `SeedPool` inside `BoardScene` that pre-creates 30 seed `Image` objects (all hidden/inactive) in `create`; `acquire(colour)` activates and returns the next available image with the correct texture; `release(img)` hides and deactivates it
    - _Requirements: 5.1, 5.5_
  - [x] 5.2 Implement `populateRestingSeeds(holeData: HoleData, count: number)` — releases any existing resting seeds for that hole back to the pool, then acquires `count` new seeds using `getSeedColour(i)` per seed index and positions them in a small cluster around the hole centre; call for every hole during `create` and after each animation completes
    - _Requirements: 5.1, 5.2, 5.5_
  - [x] 5.3 Before the first arc animation of any move, call `holeData.restingSeeds.forEach(img => pool.release(img))` on the source hole and clear `holeData.restingSeeds`; when a seed is dropped during animation, call `populateRestingSeeds` for that hole immediately
    - _Requirements: 5.3, 5.4_
  - [x] 5.4 After tembak is detected, hide resting seeds in both the landing hole and its opposite hole before animating captured seeds to the house
    - _Requirements: 5.6_

- [x] 6. Implement GlowState and PreviewHighlight interaction (Requirement 6)
  - [x] 6.1 Implement `applyGlow(holeData: HoleData)` — add a looping alpha-pulse tween on the zone using additive blend; store the tween reference in `holeData.glowTweens`; call for all player holes with `board[i] > 0` at the start of each player turn
    - _Requirements: 6.1_
  - [x] 6.2 Implement `removeAllGlows()` — stop and remove all glow tweens for every hole, set `isGlowing` to false; call this immediately when a hole is clicked and when it becomes the opponent's turn
    - _Requirements: 6.2, 6.5_
  - [x] 6.3 Attach `pointerover` and `pointerout` listeners to each player hole zone; on `pointerover`, call `previewLastSeed(board, index, true)` and apply a PreviewHighlight (a coloured rectangle or tint overlay) to `holeData[result.landingHole]`; on `pointerout`, remove the highlight
    - _Requirements: 6.3, 6.4, 6.7_
  - [x] 6.4 Attach a `pointerup` listener to each player hole zone; on click, guard with `sceneState === SceneState.PLAYER_TURN` before proceeding; call `removeAllGlows()`, disable all player zone input, and begin the move animation
    - _Requirements: 6.5, 6.6_

- [x] 7. Implement the animation pipeline — `SeedStep[]` → sequential Promise chain (Requirement 7)
  - [x] 7.1 Implement `animateMove(holeIndex: number, isPlayer: boolean): Promise<void>` — call `getSeedPath(board, holeIndex, isPlayer)` to get the steps; set `sceneState` to `ANIMATING`; call `updateLabels` before the first arc
    - _Requirements: 7.1, 4.3_
  - [-] 7.2 For each `SeedStep` of type `'sow'`, animate a seed sprite from `fromHole` position to `toHole` position along a parabolic arc (midpoint lifted by ~80 px) using a Phaser tween lasting 200 ms; return a Promise that resolves when the tween completes
    - _Requirements: 7.3_
  - [-] 7.3 For each `SeedStep` of type `'keepSowing'`, resolve a 150 ms pause Promise before continuing to the next step
    - _Requirements: 7.4_
  - [-] 7.4 For each `SeedStep` of type `'extraTurn'`, animate the final seed into the player house, then display "Your turn again!" in the gameplay textbox (via a `Phaser.GameObjects.Text` or updating a shared textbox text object) before returning
    - _Requirements: 7.5_
  - [-] 7.5 For each `SeedStep` of type `'tembak'`, animate the landing seed to the mover's house first, then animate each subsequent tembak step from the opposite hole to the house one at a time
    - _Requirements: 7.6_
  - [-] 7.6 Maintain a `hand_fist` sprite at the source hole during pick-up; swap to `hand_open` at each drop point; move the hand sprite to follow the seed arc using tween callbacks
    - _Requirements: 7.7_
  - [x] 7.7 After all SeedSteps have been processed, call `applyFullMove` to get the final board state, replace `this.board`, call `populateRestingSeeds` for every hole, and call `updateLabels`
    - _Requirements: 7.9_
  - [x] 7.8 After updating the board, call the board state invariant check: assert `totalSeeds(board) === initialSeedCount`; if mismatched, `console.error` the board array and expected total; always continue
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 8. Implement turn state machine (Requirement 8)
  - [x] 8.1 In `create`, set `sceneState = SceneState.PLAYER_TURN` and call `applyGlow` for all player holes with seeds; implement `endPlayerTurn(result: FullMoveResult)` — if `result.extraTurn`, stay in `PLAYER_TURN` and re-apply glows; else switch to `SceneState.OPP_TURN` and call `triggerOpponentTurn()`
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 8.2 Implement `endOpponentTurn(result: FullMoveResult)` — if `result.extraTurn` and `oppExtraTurnCount < 5`, increment `oppExtraTurnCount`, stay in `OPP_TURN`, and schedule another opponent move after 800–1200 ms; else reset `oppExtraTurnCount`, switch to `PLAYER_TURN`, re-apply glows
    - _Requirements: 8.2, 8.3, 9.7_
  - [x] 8.3 After each turn ends, call `hasLegalMove` for the next active mover; if no legal move, call `endGame(getWinner(board))`; if the player has no legal move, call `endGame` immediately without starting a new turn
    - _Requirements: 8.4, 8.5_
  - [x] 8.4 Guard the player hole `pointerup` handler: if `sceneState !== SceneState.PLAYER_TURN`, drop the event silently
    - _Requirements: 8.6_

- [x] 9. Implement `triggerOpponentTurn` and connect opponent AI (Requirement 9)
  - [x] 9.1 Implement `triggerOpponentTurn()` — schedule a `this.time.delayedCall(800 + Math.random() * 400, ...)` callback; inside the callback, call `selectOpponentHole(board)` to get the chosen hole, then call `animateMove(hole, false)`; after the animation resolves, call `endOpponentTurn` with the `FullMoveResult`
    - _Requirements: 9.1, 9.2–9.6_
  - [x] 9.2 If `hasLegalMove(board, false)` is false when `triggerOpponentTurn` fires, call `endGame(getWinner(board))` immediately without animating
    - _Requirements: 9.8_

- [x] 10. Implement opponent portrait reactions (Requirement 10)
  - [x] 10.1 When the player's hole click is confirmed (start of player move animation), if opponent is `wan_mahora`, swap portrait to `wan_mahora_annoyed`
    - _Requirements: 10.2_
  - [x] 10.2 When the player's move animation completes with a tembak capture landing in an opponent hole (`result.captured === true && result.captureHole` is in OPP_HOLES), swap portrait to `<opponent>_angry` for both characters
    - _Requirements: 10.3_
  - [x] 10.3 When `triggerOpponentTurn()` fires (at the start of the opponent's turn), revert portrait to `<opponent>_calm`
    - _Requirements: 10.4_
  - [x] 10.4 Implement `setPortrait(pose: string)` — calls `setTexture` on the portrait sprite with key `<opponent>_<pose>`; ensure `setTint` and alpha modification are never called on the portrait sprite anywhere in the file
    - _Requirements: 10.5_

- [x] 11. Implement `GameOverlay` and RETRY (Requirement 11)
  - [x] 11.1 Implement `createGameOverlay(scene, message, onRetry)` — build a `Phaser.GameObjects.Container` at depth 100 with: a semi-transparent dark rectangle (600×300, centred at 960×540), a result text object at (960, 490), and a RETRY `Text` button at (960, 590) with `setInteractive()` and a `pointerup` listener that calls `onRetry`
    - _Requirements: 11.5_
  - [x] 11.2 Implement `endGame(result: GameResult)` — set `sceneState = SceneState.GAME_OVER`, disable all hole input; call `createGameOverlay` with `'You win!'` if `result === 'player'`, else `'You lose.'`; wire `onRetry` to `this.scene.restart(this.resolvedConfig)`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 11.7_

- [x] 12. Checkpoint — scene renders and game loop works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Write property and unit tests in `boardScene.helpers.test.ts` (Requirement 13 + Properties 1–7)
  - [x] 13.1 Create `frontend/src/scenes/boardScene.helpers.test.ts`; import `parseRoundConfig`, `getSeedColour`, `selectOpponentHole`, `SEED_COLOURS` from `BoardScene.ts` and `getSeedPath`, `previewLastSeed`, `hasLegalMove`, `makeBoard` from `congkak.ts`
    - _Requirements: 1.1–1.8, 5.2, 9.2–9.6_
  - [x]* 13.2 Write property test — Property 1: `parseRoundConfig` always produces valid output
    - Use `fc.anything()` as the arbitrary; assert `round` ∈ {1,2}, `seedsPerHole` is a positive integer, `background` ∈ {'room','outside'}, `opponent` ∈ {'wan_mahora','village_chief'}
    - **Property 1: parseRoundConfig always produces valid output**
    - **Validates: Requirements 1.1, 1.7, 1.8**
  - [x]* 13.3 Write property test — Property 2: `parseRoundConfig` preserves valid seedsPerHole overrides
    - Use `fc.integer({ min: 1, max: 200 })` for n; assert `parseRoundConfig({ round: 1, seedsPerHole: n }).seedsPerHole === n`
    - **Property 2: parseRoundConfig preserves valid seedsPerHole overrides**
    - **Validates: Requirements 1.4**
  - [x]* 13.4 Write property test — Property 3: `getSeedColour` is cyclic
    - Use `fc.nat()` for i; assert `getSeedColour(i) === SEED_COLOURS[i % 6]` and `getSeedColour(i) === getSeedColour(i + 6)`
    - **Property 3: getSeedColour is cyclic**
    - **Validates: Requirements 5.2**
  - [x]* 13.5 Write property test — Property 4: `getSeedPath` steps have strictly increasing seedIndex from zero
    - Use a board arbitrary with at least one legal player hole; assert `steps[k].seedIndex === k` for all k
    - **Property 4: getSeedPath seedIndex values are strictly sequential from zero**
    - **Validates: Requirements 7.1, 7.2**
  - [x]* 13.6 Write property test — Property 5: `selectOpponentHole` always returns a legal hole
    - Generate boards where `hasLegalMove(board, false)` is true; assert returned index ∈ [4,5,6] and `board[index] > 0`
    - **Property 5: selectOpponentHole always returns a legal hole**
    - **Validates: Requirements 9.2, 9.6**
  - [x]* 13.7 Write property test — Property 6: `selectOpponentHole` prefers extra-turn holes
    - Generate boards that guarantee at least one opponent hole has `willExtraTurn === true`; assert `previewLastSeed(board, result, false).willExtraTurn === true`
    - **Property 6: selectOpponentHole prefers extra-turn holes**
    - **Validates: Requirements 9.3, 9.4**
  - [x]* 13.8 Write property test — Property 7: `selectOpponentHole` prefers capture holes when no extra-turn available
    - Generate boards with no extra-turn hole but at least one capture hole; assert `previewLastSeed(board, result, false).willCapture === true`
    - **Property 7: selectOpponentHole prefers capture holes when no extra-turn**
    - **Validates: Requirements 9.5**
  - [x] 13.9 Write example-based unit tests for `parseRoundConfig`: round 1 defaults (no args), round 2 defaults, explicit `seedsPerHole` preserved, `seedsPerHole: 0` discarded, `seedsPerHole: -1` discarded, `seedsPerHole: 1.5` discarded, missing `round` falls back to 1
    - _Requirements: 1.2, 1.3, 1.7, 1.8_
  - [x] 13.10 Write example-based unit tests for `selectOpponentHole`: prefers extra-turn hole when available, prefers capture hole when no extra-turn, picks from legal holes when neither applies
    - _Requirements: 9.3, 9.4, 9.5_

- [x] 14. Add `BoardScene` to `main.ts` and add `DemoKeyListener` (Requirement 12)
  - [x] 14.1 Import `BoardScene` in `frontend/src/main.ts` and add it to the `scene` array in the Phaser config
    - _Requirements: 12.6_
  - [x] 14.2 After `new Phaser.Game(config)`, add a `DemoKeyListener` that registers a `keydown` listener on `window`; on `D` key down, record timestamp; on digit `1` within 1000 ms, call `game.scene.stop(activeScene)` then `game.scene.start('BoardScene', { round: 1 })`; on digit `2` within 1000 ms, start with `{ round: 2 }`; ignore digits `3`–`9`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 15. Final checkpoint — build passes and all tests pass
  - Run `cd frontend && npm run test` and confirm all tests pass. Run `npm run build` and confirm the TypeScript compiler reports zero errors. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests must be tagged with: `// Feature: board-scene, Property N: <name>`
- `selectOpponentHole` uses `Math.random()` instead of `Phaser.Math.RND` to stay import-free; this makes it testable without mocking Phaser
- `animateMove` calls `applyFullMove` once at the end (task 7.7) rather than after each step — the visual state during animation is driven by the `SeedStep` sequence from `getSeedPath`, which is already in sync with `applyFullMove` output
- Property-test arbitraries for `selectOpponentHole` (tasks 13.6–13.8) require careful board construction; see the design's board-arbitrary pattern in the congkak-rules spec for reference
- Run property tests with at least 100 iterations (fast-check default is sufficient)
- `HOLE_POSITIONS` pixel coordinates are design estimates; the implementation note in the design says to tune them against actual `congkak_board.png` pixel content — mark with a `// TODO: tune` comment

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["4.1", "5.1"] },
    { "id": 5, "tasks": ["4.2", "5.2"] },
    { "id": 6, "tasks": ["5.3", "5.4", "6.1", "6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 10, "tasks": ["7.7"] },
    { "id": 11, "tasks": ["7.8", "8.1"] },
    { "id": 12, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 13, "tasks": ["9.1", "9.2"] },
    { "id": 14, "tasks": ["10.1", "10.2", "10.3", "10.4"] },
    { "id": 15, "tasks": ["11.1"] },
    { "id": 16, "tasks": ["11.2"] },
    { "id": 17, "tasks": ["13.1"] },
    { "id": 18, "tasks": ["13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "13.8", "13.9", "13.10"] },
    { "id": 19, "tasks": ["14.1"] },
    { "id": 20, "tasks": ["14.2"] }
  ]
}
```
