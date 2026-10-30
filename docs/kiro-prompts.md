# Kiro prompts, in build order

Steering in `.kiro/steering/` already holds the story, rules, characters and style, so prompts can stay short. Run **one spec at a time**: review requirements → design → run tasks one by one → play-test. If Kiro builds the wrong thing, fix the spec, not the code.

## 0. Scaffold (Vibe chat)
```
Set up frontend/ as a Vite + TypeScript (strict) + Phaser 3 project, following .kiro/steering/tech.md and structure.md. Serve the repo-root assets/ folder as Vite's publicDir. Add Vitest and fast-check with an `npm test` script. Create a Boot scene that preloads assets/backgrounds/room/room_preview.png and shows it at 1920x1080 with Phaser.Scale.FIT. Do not move, rename or modify anything in assets/. Check: `npm run dev` shows the room, `npm test` runs.
```

## 1. Spec: congkak-rules
```
Create a spec called congkak-rules: pure TypeScript game logic in frontend/src/logic/ with no Phaser imports, exactly as described in .kiro/steering/gameplay.md (3 holes + house per side, 3 or 4 seeds per hole, player always first, sowing, extra turn, keep sowing, tembak capture, game end). Include a function that returns the step-by-step path of every seed for a move (needed for animation and replay) and one that previews where the last seed lands. Unit-test every rule, and add fast-check property tests: total seeds never change on a legal move, and a game always ends.
```

## 2. Spec: board-scene
```
Create a spec called board-scene: a Phaser scene for round 1 using the room background, the opponent portrait behind the board (assets/characters/wan_mahora/*), and assets/board/congkak_board.png at the bottom centre with seed sprites (assets/board/seeds). Use the congkak-rules module. Playable holes glow; hovering previews where the last seed lands; seeds move hole to hole with a dark hand (assets/ui/hands) carrying them; a count above each hole. Make it work for round 2 too (outside background, village chief, 4 seeds per hole).
```

## 3. Spec: opponent-cheats
```
Create a spec called opponent-cheats, following the Cheats section of .kiro/steering/gameplay.md exactly: a simple move-choice heuristic (prefer extra turns and captures), per-opponent cheat pools, random cheat type and timing each round and retry, Wan Mahora's first cheat always "extra seed", round 2 always exactly one lights-out swap, no cheat twice in a row, and the tembak red herring. Every cheat is logged as an event (type, turn, time window, screen region). Unit-test the scheduler with a seeded random generator.
```

## 4. Spec: rewind-callout
```
Create a spec called rewind-callout, following the Rewind and Tape health sections of .kiro/steering/gameplay.md: REW button on the tape HUD (3 per round), zoom into the board with VHS tearing, slow top-down replay on congkak_board_flat.png, "Tap when you see something off!", hit detection against the cheat event's region and time window, TIPU! stamp with shake, undo the cheat, opponent angry pose, tape damage on misses, tape HUD with depleting red line, shaking and spinning reels, tape snap → round restart. Unit-test hit detection and health logic.
```

## 5. Spec: story-and-dialogue
```
Create a spec called story-and-dialogue: a scene state machine for the full flow in .kiro/steering/product.md, and the two text boxes from .kiro/steering/style.md (story box full width, gameplay box on the left, name tag, typewriter text, word-wrap, name-tag auto-shrink, click to continue). Move every line from .kiro/steering/story.md into frontend/src/data/dialogue.json with character + pose tags so portraits switch pose. Add the always-on ? button that opens the How to Play slides (assets/ui/howto/slides with ui_arrow_next/back), the gentle tip after 2 wrong clicks, and a hidden demo key to jump to any scene.
```

## 6. Spec: memories-and-reveal
```
Create a spec called memories-and-reveal: memory 1 (4 animated photo GIFs as cream deckled cards with red date stamps, shuffling in a pile on assets/backgrounds/memory1/table_wood_bg.png with the aged keris), memory 2 (3 cards on assets/backgrounds/outside/ground_topdown_bg.png, ending on white_blood_final.png), the reveal (zoom into the tree photo, glitch, white flash, mahsuri_tied_reveal.png centred with the tree photo behind her, text box appears at the same time), and the curse scene where 4 photo cards pop in top-left to bottom-right, each tappable to open a large view with title + description, Continue unlocking after all 4. Text from dialogue.json.
```

## 7. Spec: title-screen
```
Create a spec called title-screen using Three.js as in .kiro/steering/tech.md: dark scene, assets/3d/old_tv.glb on assets/3d/vhs_player.glb on the left, a CD stack built from simple geometry, red screen glow, a bloody glitching "TIPU!" in Creepster on the TV screen, and a menu on the right (PLAY / HOW TO PLAY / SETTINGS). PLAY pushes a tape into the VCR, the TV flickers, then hands over to Phaser.
```

## 8. Spec: vhs-effects-and-sound
```
Create a spec called vhs-effects-and-sound following .kiro/steering/style.md: light always-on VHS filter that strengthens in round 2, never tinting characters; lamp flicker; white flash; VCR text (PLAY/REW/STOP); chapter cards with the spinning tape; sound layers (crickets, whispers, heartbeat, tape whirr, stamp thunk) that start after the first click, with a mute toggle in Settings.
```

## 9. Ending + polish (Vibe chat, one change per prompt)
- Dawn scene with Noelle's painted sunrise, then rolling credits from story.md ending on THE END.
- Convert large PNGs to compressed WebP at build time; check load time.
- Deploy `frontend/dist` to GitHub Pages / Netlify and put the link in README.md.

## Hooks (create from the Kiro Hooks panel)
- **Rules guard:** "When a file in frontend/src/logic/ is saved, run the unit tests and tell me in plain words which rule failed."
- **Asset check:** "When an image is added to assets/, check the name is lowercase_with_underscores and character images have transparent backgrounds. Report problems; don't change files."
- **Dialogue check:** "When frontend/src/data/dialogue.json is saved, check every line has a valid character and pose, is under 12 words, and matches .kiro/steering/characters.md."
- **Credits + README:** "When a spec task is completed, update README.md (features, how to run) and remind me to add any new third-party asset to CREDITS.md."

## Capture for the write-up
Screenshot: each steering file, a spec before/after your corrections, a hook catching a real bug, and the property tests passing.
