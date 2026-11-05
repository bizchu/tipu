# Requirements Document: Story Flow (opening)

## Introduction
The opening of TIPU!: the 3D title screen, chapter cards, the prologue, How to Play and the hand-off into round 1, plus the always-on help button. Follows `.kiro/steering/product.md`, `story.md` and `style.md`.

## Requirements

### Requirement 1: Title screen
1. THE game SHALL open on a 3D scene: old TV (assets/3d/old_tv.glb) on a VHS player (assets/3d/vhs_player.glb), a CD stack built from simple geometry, red screen glow.
2. THE TV screen SHALL show a bloody "TIPU!" in Creepster that glitches in random bursts.
3. THE screen SHALL show a menu on the right: PLAY, HOW TO PLAY, SETTINGS. There SHALL be no title text.
4. WHEN PLAY is pressed, THE screen SHALL glitch fully, fade to black and start the Chapter 1 card.
5. IF the 3D scene fails to load, THE game SHALL skip straight to the Chapter 1 card.

### Requirement 2: Chapter cards
1. EACH chapter card SHALL show "▶ PLAY", "TAPE n", a spinning VHS tape, "BAB n · CHAPTER n", the Malay title, the English subtitle and the opponent name.
2. Chapter 1 = "Pembohongan / The Lie / Wan Mahora". Chapter 2 = "Kebenaran / The Truth / The Village Chief".
3. THE card SHALL advance after about 3.6 s or on click, exactly once.

### Requirement 3: Prologue
1. THE prologue SHALL open with eyelids blinking open over the dark room, with the "▶ PLAY" VCR text fading out.
2. Mahsuri (name tag "???") SHALL speak the three wake-up lines, switching between confused and scared poses.
3. Mahsuri SHALL fade out and Wan Mahora SHALL fade in behind the board before her four lines.
4. All lines SHALL come from `frontend/src/data/dialogue.json` and use the full-width story box with typewriter text; click, Space or Enter advances (first press completes the line).

### Requirement 4: How to Play
1. THE How to Play overlay SHALL show the six parchment slides with back/next arrows, a counter and a close button; arrow keys and Esc also work.
2. FROM the main flow it SHALL lead into round 1; FROM the title it SHALL return to the title; FROM the ? button it SHALL pause and then resume the current scene.

### Requirement 5: Help button and gentle tips
1. A ? button SHALL sit bottom-left during gameplay and open How to Play.
2. WHEN the player clicks an empty hole or an opponent hole, THE game SHALL show a short in-world tip; after 2 wrong clicks the ? button SHALL pulse.

### Requirement 6: Round transitions
1. Winning round 1 SHALL show CONTINUE ▶ which plays the Chapter 2 card and starts round 2.
2. Losing SHALL show "◀◀ REWIND & RETRY" which restarts the round.
3. Until the memory scenes exist, winning round 2 SHALL show a temporary "The tape continues..." card.

### Requirement 7: Demo keys
D then 1–6 within 1 s jumps to: round 1, round 2, prologue, chapter 1 card, chapter 2 card, How to Play.
