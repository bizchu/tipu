# Requirements Document

## Introduction

This spec covers the `BoardScene` Phaser scene — a playable congkak mini-game used for round 1 (indoor room) and round 2 (outdoor night). The scene wraps the existing pure-TypeScript `congkak.ts` logic module and adds a full visual layer: background, opponent portrait, the congkak board with animated seed sprites, interactive hole selection, opponent AI, and a win/lose overlay. Cheat injection, VHS rewind, and the tape health system are out of scope for this spec.

## Glossary

- **BoardScene**: The Phaser 3 scene that hosts the playable congkak round (`frontend/src/scenes/BoardScene.ts`).
- **RoundConfig**: A plain TypeScript object passed to `BoardScene` at launch that controls round number, seed count, background, and opponent portrait.
- **CongkakLogic**: The pure-TypeScript module at `frontend/src/logic/congkak.ts`. Exports `Board`, `applyFullMove`, `getSeedPath`, `previewLastSeed`, `hasLegalMove`, `getWinner`, `makeBoard`, `totalSeeds`, `PLAYER_HOLES`, `PLAYER_HOUSE`, `OPP_HOLES`, `OPP_HOUSE`.
- **Board**: An 8-element tuple `[p0, p1, p2, pHouse, o0, o1, o2, oHouse]` where indices 0–2 are player holes, index 3 is the player house, indices 4–6 are opponent holes, and index 7 is the opponent house.
- **HoleSprite**: The interactive Phaser `GameObject` (image or zone) that represents one hole or house on the board.
- **SeedSprite**: A Phaser `Image` showing one seed, animated along the path returned by `getSeedPath`.
- **SeedStep**: One element of the `SeedStep[]` returned by `getSeedPath`. Fields: `seedIndex`, `fromHole`, `toHole`, `type` (`'sow' | 'keepSowing' | 'extraTurn' | 'tembak'`).
- **GlowState**: The visual state of a HoleSprite indicating it is interactive (golden/additive tint pulse).
- **PreviewHighlight**: A transient visual overlay on a HoleSprite showing where the last seed will land, triggered by pointer-over.
- **OpponentAI**: The in-scene logic that selects and animates the opponent's move after the player's turn ends.
- **GameOverlay**: The Phaser `Container` shown when the game ends, containing result text and a RETRY button.
- **GameplayTextbox**: The small dialogue box displayed on the left side of the screen during gameplay (asset `ui/textbox_gameplay.png`).

---

## Requirements

### Requirement 1: Scene Configuration

**User Story:** As a developer, I want to launch `BoardScene` with a `RoundConfig` object, so that the same scene class handles both round 1 and round 2 without branching logic in the caller.

#### Acceptance Criteria

1. THE `BoardScene` SHALL accept a `RoundConfig` object via `scene.start('BoardScene', config)` containing the fields `round` (1 | 2), `seedsPerHole` (number), `background` ('room' | 'outside'), and `opponent` ('wan_mahora' | 'village_chief').
2. WHEN `round` is 1 and no `seedsPerHole` is provided, THE `BoardScene` SHALL initialise the board using `makeBoard(3)`.
3. WHEN `round` is 2 and no `seedsPerHole` is provided, THE `BoardScene` SHALL initialise the board using `makeBoard(4)`.
4. IF `seedsPerHole` is provided in `RoundConfig` as a positive integer, THEN THE `BoardScene` SHALL pass that value to `makeBoard`, overriding the value derived from `round`.
5. WHEN `BoardScene` initialises, THE `BoardScene` SHALL load the background image asset whose key matches the `background` field.
6. WHEN `BoardScene` initialises, THE `BoardScene` SHALL load the portrait sprites whose keys match the `opponent` field.
7. IF any of the fields `round`, `background`, or `opponent` are absent or contain an out-of-range value, THEN THE `BoardScene` SHALL fall back to round 1 defaults (`seedsPerHole: 3`, `background: 'room'`, `opponent: 'wan_mahora'`).
8. IF `seedsPerHole` is provided but is not a positive integer (e.g. `0`, `-1`, or a non-integer), THEN THE `BoardScene` SHALL fall back to deriving `seedsPerHole` from the `round` field as per criteria 2 and 3.

---

### Requirement 2: Asset Loading

**User Story:** As a developer, I want all scene assets to be declared and loaded in `preload`, so that the scene never renders with missing images.

#### Acceptance Criteria

1. WHEN the `preload` lifecycle method runs, THE `BoardScene` SHALL load all required assets listed in criteria 2–8 before the `create` method executes.
2. THE `BoardScene` SHALL load background images for both `'room'` (`backgrounds/room/room_preview.png`) and `'outside'` (`backgrounds/outside/outside_preview.png`).
3. THE `BoardScene` SHALL load all three opponent portrait frames for `wan_mahora`: `characters/wan_mahora/wan_mahora_calm.png`, `wan_mahora_annoyed.png`, `wan_mahora_angry.png`.
4. THE `BoardScene` SHALL load all four opponent portrait frames for `village_chief`: `characters/village_chief/village_chief_calm.png`, `village_chief_angry.png`, `village_chief_dead.png`, `village_chief_dead_grey.png`.
5. THE `BoardScene` SHALL load both board images: `board/congkak_board.png` and `board/congkak_board_flat.png`.
6. THE `BoardScene` SHALL load all six seed images: `board/seeds/seed_black.png`, `seed_blue.png`, `seed_green.png`, `seed_red.png`, `seed_white.png`, `seed_yellow.png`.
7. THE `BoardScene` SHALL load all five hand images: `ui/hands/hand_fist.png`, `ui/hands/hand_open.png`, `ui/hands/hand_claw.png`, `ui/hands/hand_grab.png`, `ui/hands/hand_reach.png`.
8. THE `BoardScene` SHALL load the gameplay textbox asset `ui/textbox_gameplay.png`.

---

### Requirement 3: Layout

**User Story:** As a player, I want the board, characters, and UI to appear in consistent, readable positions at 1920×1080, so that nothing overlaps or falls off screen.

#### Acceptance Criteria

1. THE `BoardScene` SHALL render the background image scaled to fill the full 1920×1080 canvas without letterboxing or pillarboxing within the base resolution.
2. WHEN the `BoardScene` initialises, THE `BoardScene` SHALL position the opponent portrait with its horizontal centre at x = 960 and its vertical centre between y = 200 and y = 500, behind the board layer in z-order.
3. THE `BoardScene` SHALL anchor `congkak_board.png` with its horizontal centre at x = 960 and its vertical centre at y = 900, ± 10 px.
4. THE `BoardScene` SHALL map player holes (indices 0, 1, 2) to the bottom row of the board image such that each hole centre falls within the visible seed pit area of `congkak_board.png`.
5. THE `BoardScene` SHALL map opponent holes (indices 4, 5, 6) to the top row of the board image such that each hole centre falls within the visible seed pit area of `congkak_board.png`.
6. THE `BoardScene` SHALL map the player house (index 3) to the right-end pit of the board image such that its centre falls within the visible house area of `congkak_board.png`.
7. THE `BoardScene` SHALL map the opponent house (index 7) to the left-end pit of the board image such that its centre falls within the visible house area of `congkak_board.png`.
8. THE `BoardScene` SHALL position the gameplay textbox with its left edge at x = 40, its top edge between y = 700 and y = 780, and its right edge no further than x = 640, so that the board remains fully visible to the right.
9. IF the browser window dimensions produce a Phaser scale factor below 1.0, THEN THE `BoardScene` SHALL maintain all element positions relative to the 1920×1080 base canvas so that no element's bounding box extends beyond x = 1920 or y = 1080 in base coordinates.

---

### Requirement 4: Seed Count Display

**User Story:** As a player, I want to see the number of seeds in each hole and house at all times, so that I can plan my moves.

#### Acceptance Criteria

1. THE `BoardScene` SHALL display a numeric label above each hole (indices 0–2, 4–6) showing the current seed count (0 to 24) from the `Board` state.
2. THE `BoardScene` SHALL display a numeric label above each house (index 3, index 7) showing the current seed count (0 to 24) from the `Board` state.
3. WHEN the `Board` state changes after any move, THE `BoardScene` SHALL update all seed count labels before any move animation begins.
4. THE `BoardScene` SHALL render each seed count label fully within its designated area, not clipped and not overlapping an adjacent label, at any valid seed count from 0 to 24.

---

### Requirement 5: Seed Sprites

**User Story:** As a player, I want to see coloured seed sprites resting in each hole, so that the board looks populated and visually clear.

#### Acceptance Criteria

1. WHEN the `BoardScene` initialises, THE `BoardScene` SHALL display exactly `board[holeIndex]` resting seed sprites inside each hole; holes with a count of 0 SHALL display no sprites.
2. THE `BoardScene` SHALL assign seed colours using a fixed cyclic order (`black`, `blue`, `green`, `red`, `white`, `yellow`, then repeating) so that seed i in a hole uses colour `colours[i % 6]`; a seed's colour SHALL NOT change between moves unless the seed is removed from the board.
3. WHEN the first sowing step of a move animation begins, THE `BoardScene` SHALL remove or hide all resting seed sprites from the source hole before the first arc animation plays.
4. WHEN a seed sprite is dropped into a hole during animation, THE `BoardScene` SHALL immediately add or show a resting seed sprite in that hole so the running count of visible sprites in that hole equals `current_board[holeIndex]` at that point in the animation.
5. WHEN a move animation completes, THE `BoardScene` SHALL display exactly `board[holeIndex]` resting seed sprites in each hole, with zero stale sprites remaining.
6. WHEN a tembak capture event occurs, THE `BoardScene` SHALL hide the resting seed sprites in both the landing hole and its opposite hole before animating the captured seeds to the mover's house.

---

### Requirement 6: Interaction — Hole Selection

**User Story:** As a player, I want to clearly see which holes I can click and get feedback before committing a move, so that gameplay feels responsive and I don't make accidental moves.

#### Acceptance Criteria

1. WHILE it is the player's turn and no move animation is running, THE `BoardScene` SHALL apply a GlowState to each player hole (indices 0, 1, 2) that has a seed count greater than zero.
2. WHILE it is the opponent's turn or a move animation is running, THE `BoardScene` SHALL remove GlowState and PreviewHighlight from all player holes and disable pointer events on all player holes.
3. WHEN the pointer enters a player hole that has GlowState applied, THE `BoardScene` SHALL call `previewLastSeed(board, holeIndex, true)` and apply a PreviewHighlight to the `landingHole` returned by that call.
4. WHEN the pointer leaves a player hole that previously triggered a PreviewHighlight, THE `BoardScene` SHALL remove that PreviewHighlight.
5. WHEN the player clicks a glowing hole, THE `BoardScene` SHALL within the same frame remove GlowState and PreviewHighlight from all player holes and disable pointer events; THE `BoardScene` SHALL then begin the move animation for that hole.
6. WHEN a player hole's seed count reaches zero during an extra-turn chain, THE `BoardScene` SHALL immediately remove any existing GlowState from that hole and SHALL NOT re-apply GlowState to it until the next player turn begins.
7. WHEN `previewLastSeed` returns a `landingHole` equal to the player house (index 3), THE `BoardScene` SHALL apply the PreviewHighlight to the player house sprite.

---

### Requirement 7: Seed Animation

**User Story:** As a player, I want to watch seeds travel from hole to hole following the congkak sowing rules, so that I can understand what happened and catch any irregularities.

#### Acceptance Criteria

1. WHEN a move is triggered, THE `BoardScene` SHALL call `getSeedPath(board, holeIndex, isPlayer)` to obtain the full `SeedStep[]` for that turn.
2. THE `BoardScene` SHALL animate each `SeedStep` sequentially so that step N+1 does not begin until step N's animation has fully completed.
3. FOR each `SeedStep` of type `'sow'`, THE `BoardScene` SHALL animate a seed sprite travelling from the screen position of `fromHole` to the screen position of `toHole` along a short parabolic arc lasting between 150 ms and 400 ms.
4. FOR each `SeedStep` of type `'keepSowing'`, THE `BoardScene` SHALL pause for between 100 ms and 300 ms at the landing hole before re-grasping the accumulated seeds and continuing the sow.
5. FOR each `SeedStep` of type `'extraTurn'`, THE `BoardScene` SHALL animate the final seed into the player's house and then display the message "Your turn again!" in the gameplay textbox before the next player-input phase begins.
6. FOR each `SeedStep` of type `'tembak'`, THE `BoardScene` SHALL animate the landing seed to the mover's house first, then animate each captured seed from the opposite hole to the mover's house, one seed at a time.
7. THE `BoardScene` SHALL display a `hand_fist.png` sprite at the source hole during the pick-up phase and swap to `hand_open.png` at each drop point; the hand sprite SHALL follow the seed arc.
8. WHILE any move animation is running, THE `BoardScene` SHALL not accept pointer events on any hole.
9. WHEN all `SeedStep` entries have been animated, THE `BoardScene` SHALL update the `Board` state to the result of `applyFullMove` and reconcile all seed sprites and seed count labels.

---

### Requirement 8: Turn Sequencing

**User Story:** As a player, I want the game to correctly alternate turns between me and the opponent, including extra turns from landing in the house, so that the game follows congkak rules.

#### Acceptance Criteria

1. THE `BoardScene` SHALL begin each round with the player's (Mahsuri's) side as the active mover.
2. WHEN `applyFullMove` returns `extraTurn: true`, THE `BoardScene` SHALL grant another turn to the same mover without switching sides, and SHALL NOT invoke opponent AI logic for that continuation turn.
3. WHEN `applyFullMove` returns `extraTurn: false` and `captured: false`, THE `BoardScene` SHALL switch the active mover to the other side exactly once.
4. WHEN `applyFullMove` returns `captured: true` (tembak), THE `BoardScene` SHALL switch the active mover to the other side exactly once and SHALL NOT grant an extra turn.
5. AFTER each turn resolves, THE `BoardScene` SHALL call `hasLegalMove` for the next active mover; IF `hasLegalMove` returns `false`, THEN THE `BoardScene` SHALL immediately declare the round over without beginning another turn, compare house seed counts, and treat a draw as a loss for the player.
6. IF a player hole selection event fires while the active mover is the opponent, THEN THE `BoardScene` SHALL ignore the event and preserve the current board state unchanged.

---

### Requirement 9: Opponent AI

**User Story:** As a player, I want the opponent to take its turn automatically after a short pause, so that the game flows without requiring me to interact during the opponent's turn.

#### Acceptance Criteria

1. WHEN it becomes the opponent's turn, THE `BoardScene` SHALL wait between 800 milliseconds and 1200 milliseconds before selecting and animating the opponent's move.
2. THE `OpponentAI` SHALL scan opponent holes (indices 4, 5, 6) and collect all holes with a seed count greater than zero.
3. THE `OpponentAI` SHALL call `previewLastSeed(board, holeIndex, false)` for each legal hole.
4. THE `OpponentAI` SHALL select a hole that results in `willExtraTurn: true` if any such hole exists.
5. IF no extra-turn hole exists, THE `OpponentAI` SHALL select a hole that results in `willCapture: true`.
6. IF no extra-turn or capture hole exists, THE `OpponentAI` SHALL select uniformly at random from the remaining legal holes.
7. WHEN the opponent's selected move results in `extraTurn: true`, THE `BoardScene` SHALL wait between 800 milliseconds and 1200 milliseconds then trigger another opponent move without giving the player a turn, up to a maximum of 5 consecutive opponent extra-turn moves per turn sequence.
8. WHEN all opponent holes have a seed count of zero, THE `BoardScene` SHALL immediately end the game without animating a move.
9. WHEN the opponent's move animation completes and no extra turn is earned, THE `BoardScene` SHALL re-enable the player's hole selection and GlowState.
10. WHEN the opponent's selected move is animated, THE `BoardScene` SHALL use the same `getSeedPath`-driven seed-by-seed animation as the player's move, completing within the same per-seed duration range as the player animation.

---

### Requirement 10: Opponent Portrait

**User Story:** As a player, I want to see the opponent character react visually to the game state, so that the scene feels alive.

#### Acceptance Criteria

1. WHILE the board is active and no pose-changing event has occurred, THE `BoardScene` SHALL display the opponent portrait in the `calm` pose.
2. WHEN the player confirms a hole selection and the move animation begins, IF the current opponent is `wan_mahora`, THEN THE `BoardScene` SHALL switch the opponent portrait to the `annoyed` pose.
3. WHEN the player's move animation completes with a tembak capture landing in an opponent hole, THE `BoardScene` SHALL switch the opponent portrait to the `angry` pose for both `wan_mahora` and `village_chief`.
4. WHEN the opponent's turn begins, THE `BoardScene` SHALL revert the opponent portrait to the `calm` pose, clearing any `annoyed` or `angry` pose set during the player's turn.
5. THE `BoardScene` SHALL never call `setTint`, `setTintFill`, or modify the `alpha` property on the opponent portrait sprite.

---

### Requirement 11: Game End

**User Story:** As a player, I want to see a clear win/lose result when the round ends, and be able to retry, so that the game loop is complete.

#### Acceptance Criteria

1. WHEN the active player has no legal move remaining on their turn, THE `BoardScene` SHALL call `getWinner(board)` to determine the result.
2. WHEN `getWinner` returns `'player'`, THE `BoardScene` SHALL display the GameOverlay with the text "You win!".
3. WHEN `getWinner` returns `'opponent'`, THE `BoardScene` SHALL display the GameOverlay with the text "You lose.".
4. WHEN `getWinner` returns `'draw'`, THE `BoardScene` SHALL display the GameOverlay with the text "You lose." (a draw counts as a loss per game rules).
5. THE `GameOverlay` SHALL appear centred on screen with a RETRY button below the result text, layered above all other scene objects so it is not obscured.
6. WHEN the player clicks RETRY, THE `BoardScene` SHALL restart the current round by re-launching `BoardScene` with the same `RoundConfig`.
7. WHILE the `GameOverlay` is visible, THE `BoardScene` SHALL accept pointer events only on the RETRY button; all other interactive elements SHALL be disabled.

---

### Requirement 12: Demo Key Navigation

**User Story:** As a developer or judge, I want to jump directly to `BoardScene` from any scene using a keyboard shortcut, so that I can demo or test the scene without replaying the full game flow.

#### Acceptance Criteria

1. THE game SHALL register a global keyboard listener active in every scene for the sequence `D` followed by a digit key (`1`–`9`).
2. WHEN the demo key sequence `D` then `1` is detected, THE game SHALL stop the current scene and start `BoardScene` with round 1 defaults (`seedsPerHole: 3`, `background: 'room'`, `opponent: 'wan_mahora'`).
3. WHEN the demo key sequence `D` then `2` is detected, THE game SHALL stop the current scene and start `BoardScene` with round 2 defaults (`seedsPerHole: 4`, `background: 'outside'`, `opponent: 'village_chief'`).
4. IF the digit pressed after `D` is `3`–`9`, THEN THE game SHALL ignore the sequence and take no action.
5. THE global demo key listener SHALL only process the digit if it is pressed within 1000 milliseconds of the `D` key press.
6. WHERE the scene is launched directly via `scene.start('BoardScene', config)` from an external caller, THE `BoardScene` SHALL accept that `RoundConfig` without requiring a demo key sequence.

---

### Requirement 13: Board State Invariant

**User Story:** As a developer, I want confidence that the visual board always matches the logical board state, so that visual bugs cannot mask logic errors.

#### Acceptance Criteria

1. WHEN a move animation completes, THE `BoardScene` SHALL verify that the sum of the seed count labels across all 8 positions (indices 0–7) equals 18 for round 1 and 24 for round 2.
2. WHEN a move animation completes, THE `BoardScene` SHALL verify that each seed count label at index i matches `board[i]` for all i in 0–7.
3. IF the verification in criterion 1 fails, THEN THE `BoardScene` SHALL log a console error containing the current board state array and the expected total.
4. IF the verification in criterion 2 fails, THEN THE `BoardScene` SHALL log a console error containing the current board state array and the index where the mismatch was found.
5. AFTER logging either error, THE `BoardScene` SHALL continue gameplay without interruption.
