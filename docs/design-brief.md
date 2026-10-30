# Congkak Malam / Main Lagi — Project Brief
_Working title. Final title TBD (favourite: "Main Lagi" — a cursed VHS tape, a game of congkak, and a lie that won't stay buried)._
Kiroween 2026 · building starts 30 Oct 2026 · deadline 4 Dec 2026, 2:00 PM PT (5 Dec, 6:00 AM MYT)

## Pitch
A ~3.5-minute browser horror game. You wake at a congkak board at night with no memory. You play two rounds of mini congkak against people from the village; they cheat, and you rewind the VHS tape to catch their lies. Each round you win recovers a memory, until you realise you are Mahsuri, the wronged woman of the Langkawi legend.

Target category: Resurrection (VHS tape is the core mechanic) — Costume Contest as backup. One category per project last year; confirm on 30 Oct.

## Legend (version used)
Source: https://en.wikipedia.org/wiki/Mahsuri
- Husband Wan Darus away at war. Traveller Deramang stays nearby.
- Wan Mahora, the village chief's wife, jealous of Mahsuri's beauty, spreads a rumour of an affair.
- Mahsuri is tied to a tree; ordinary weapons fail; she is killed with her family keris.
- White blood flows, proving her innocence. She curses Langkawi for seven generations.
- Rules: Mahsuri is always the wronged hero. Execution never shown — only white blood as a symbol. No gore.

## Story flow
1. VHS start: worn tape with handwritten label pushed into a VCR, blue screen, "▶ PLAY".
2. Intro: Mahsuri wakes (confused pose → normal pose). Opponent: "Play. You'll remember."
3. Round 1 (TAPE 1) vs Wan Mahora — indoor kampung room.
4. Win → Memory 1 "The lie": happy kampung life, husband leaves for war, Deramang arrives, gossip, accusation.
5. Round 2 (TAPE 2) vs the village chief — outside at night under the big tree, torches, villager silhouettes.
6. Win → Memory 2 "The truth": tree, keris, white blood, curse, her name. White-flash reveal.
7. Endings: Win = justice — "■ STOP", tape ejects, dawn, she rests. Lose = forgotten — "◀◀ REW", tape rewinds, she forgets, waits for the next player.
- Lose a round: memory stays locked, replay the round. Lose the final round or tape snaps: forgotten ending.
- Twist: a pale woman in white flickers in the dresser mirror throughout; players assume pontianak; at the reveal it's Mahsuri's own reflection.

## Timing (~3.5 min)
| Time | Part |
|---|---|
| 0:00–0:20 | VHS start + intro |
| 0:20–1:40 | Round 1 vs Wan Mahora (tutorial hints early) |
| 1:40–3:10 | Round 2 vs village chief |
| 3:10–3:40 | Ending |
Hidden demo-mode key to jump to any part.

## Mini congkak rules
- 3 holes per player + 1 house each, 3 seeds per hole (18 seeds; 10 wins).
- Pick up all seeds from one of your holes, sow one per hole anticlockwise, including your own house, skipping the opponent's house.
- Last seed in your house → extra turn. In a non-empty hole → pick up and keep sowing. In an empty hole on your side → capture it + the opposite hole into your house, turn ends. In an empty hole on their side → turn ends.
- Game ends when the current player has no legal move; most seeds in house wins.
- Simulation: 3×3 board ≈ 8 turns median per game.

## Opponents and cheats (only opponents cheat; Mahsuri is honest)
Wan Mahora — sweet, calls you "sayang", hides behind her fan; sneaky cheats:
- Steal a seed (sleeve brushes your hole) — 2-point swing
- Extra seed dropped from her fan — +1
- Skip your hole while sowing — ~1–2
Village chief — cold, formal, like a judge; bold cheats:
- Extra turn he shouldn't get — ~2–4
- Swap two holes when the light flickers — ~3–5
- Nudge last seed into an empty hole to capture — ~3–5
Behaviour: cheat more when losing, target your biggest hole, save big cheats for the end. ~4–5 cheats per round. Caught cheats fully undone; player can always win by catching the big ones.

## Core VHS mechanic — rewind and call out (Danganronpa-style)
1. Opponent moves; something looks off.
2. Press ◀◀ REW: the tape replays their move slowly in grainy footage.
3. The cheat is visible for ~1 second in a screen region; click it in time.
4. Hit → big stamped "TIPU!" + sound hit + screen shake, move undone, opponent switches to annoyed/angry pose (Wan Mahora lowers her fan).
5. Miss / wrong click / rewinding a clean move → tape damage.
6. 3 rewinds per round. Tape health 100 → static, colour warp, audio wobble as it drops → 0 = tape snaps → forgotten ending.

## Look and feel
- 1920×1080, full screen. Night kampung house, warm lamplight, textured darkness at edges.
- Base retro VHS filter always on (slight pixelation, limited palette, scanlines, grain); worsens each round (sepia/grain → dark, red tint, tracking glitch). White flash at reveal.
- VCR on-screen text: PLAY, PAUSE, FF (demo mode), REW (lose), STOP (win).
- Dialogue in Malay with English subtitles, under 12 words per line.
- Text boxes: story = full-width bottom box, board hidden, click to continue. Gameplay = small box on the left, board visible, auto-advances. Gold ogee frames with thin swirls + name tag.
- Sound: crickets → whispers → silence + heartbeat. Recorded whispers/laughs preferred.

## AI and voice
- Kiro = the build tool (specs, steering, hooks). The game's AI is separate.
- Optional live AI taunts (short, <10 words) via backend (e.g. Amazon Bedrock) using the characters steering file; text-to-speech optional; pre-written fallback if slow/failing; cap calls per playthrough; API keys only in backend env vars.
- Scripted story lines pre-written (voice pre-generated or recorded).

## Tech
- frontend/: Vite + TypeScript + Phaser 3
- backend/: minimal Node server only for AI taunts/voice
- .kiro/ at repo root, committed (never gitignored). Public repo, open-source licence.

## Assets (already in assets/)
- characters/mahsuri: normal, confused, scared + layers (2048×2048)
- characters/wan_mahora: calm (fan up), annoyed (fan up, angry brows), angry (fan down) + layers
- backgrounds/room: room.psd + 26 named layers, night_darkness, light_glows, window_sky_loop.gif
- board/congkak_board.png (scene angle), congkak_board_flat.png
- ui/textbox_story.png, textbox_gameplay.png, nametag.png
- mockups/: layout_story, layout_gameplay, mock_mahsuri, mock_wan_mahora
Still to make: village chief (calm + angry), outside background for round 2, seed sprites, memory 1 + 2 scenes, win ending (dawn), VHS start screen, title logo, "TIPU!" stamp.
Credits: record source + licence for every photo/third-party asset (door, rug, shutters, fan, dresser, lamp, clock, plates, chair, cushions, tapes, inserted fabric/jewellery images).

## Kiro plan (see the Kiro Build Playbook doc for full prompts)
Steering: product/tech/structure, legend.md, characters.md, style.md
Specs in order: congkak-rules → board-scene → opponent-ai → rewind-callout → story-flow → vhs-effects → dialogue-ui → ai-taunts-voice → polish
Hooks: rules tests on save, asset check, dialogue check, README + CREDITS update
Capture screenshots of steering, spec corrections and hooks catching bugs for the write-up.

## Updates (26 Oct)
- Two opponents only: Wan Mahora (round 1, indoor room) then village chief (round 2, outside kampung). Chief also has a "dead stare" close-up (grey/colour glitch loop) before the reveal.
- Title screen: 3D dark scene (Three.js) — old CRT TV on the left on a VHS player, CD stack on the table, red screen glow, bloody "TIPU!" (Creepster font, OFL) glitching on the TV. Menu on the right, English: PLAY / HOW TO PLAY / SETTINGS. No title text. Mockups: assets/mockups/title_screen.gif, mock_title_layout.png.
- Pressing PLAY: tape goes into the VCR, TV flickers on, game starts. Chapter cards between rounds (Chapter 1 / Chapter 2) with spinning tape.
- Tape health HUD: user's tape drawing, top-right; red line depletes toward the dot, tape shakes harder as health drops; REW counter chip on the tape's top-left. Files: assets/ui/tape_hud/.
- Seeds: six glossy colours (assets/board/seeds/). Text box: gold pointed frame (assets/ui/).
- 3D models (CC BY 4.0, credited in CREDITS.md): old_tv.glb, vhs_player.glb. CD stack is built in code (the Sketchfab one was non-commercial).
- To do: settings/sound/FX plan, buttons sheet, how-to-play card, memory scenes, win ending, single VHS tape model (or code-built).
- Losing (26 Oct decision): no separate "forgotten" ending. A lost round (or the tape snapping) rewinds the tape ("◀◀ REW") and the player simply retries that round. Only one ending: the win/reveal.
- Memory 1 done: 4 dated photo cards shuffled on a wooden table with a "???" narration text box (wedding 14 MAR 1817, leaving for war 02 SEP 1819, the bard 11 JUN 1820, the accusation 03 DEC 1820), aged keris on the table.
- Memory 2 to draw: the judgement, the tree, white blood (early 1821). Then reveal: chief dead stare → white flash → her face → "...that was me." → name tag ??? becomes Mahsuri.
- Cheat/rewind flow (26 Oct, see assets/mockups/cheat_catch_demo.gif): live moves play in the normal room scene with the opponent visible; a dark hand (fist carrying seeds, open hand dropping, warm rim light, arm fading into shadow) sows seed by seed with honest hole counts. The cheat happens during a lamp flicker. Player notices the count is wrong → clicks REW on the tape HUD → camera zooms into the board with VHS rewind tearing → slow-motion top-down replay where the cheat is visible → click it → red rubber-stamp TIPU! (assets/ui/tipu_stamp.png) → zoom back out, opponent switches to angry pose. Text in boxes must wrap to fit. Tape HUD reels spin (speed can follow tape health).
- Hands: assets/ui/hands/ (open, reach, claw, grab, fist). Placeholder shapes.

## Update 27 Oct: prologue, player-first, varied cheats

**Flow:** Title → Chapter 1 card → **Prologue** → How to Play → Round 1 (Wan Mahora) → Memory 1 → Chapter 2 → Round 2 (chief) → Memory 2 → Reveal → Curse (tap each photo) → Dawn.

**Prologue (~25s, room, night):** VHS "PLAY" static → Mahsuri wakes up (blurred room, eyes blinking open). Name tag "???".
- "...Where am I?"
- "What is this place?"
- "I can't remember anything... not even my name."
Wan Mahora appears behind the board, fan up:
- "Ah... you're finally awake."
- "Don't look so frightened, sayang."
- "Play a game of congkak with me. Win, and I'll help you remember."
- "Go on. You go first."

**Rule: the player always moves first** in every round (opponent cheats only on their own turns).

**Each round cheats differently (escalates):**
Round 1 – Wan Mahora (sleight of hand, easy to spot, replay ×⅓):
1. *Extra seed* – palms a seed from her sleeve, drops 2 into one pit. Tell: a pit jumps +2.
2. *Skipped pit* – hand hovers over YOUR pit but drops nothing. Tell: your pit doesn't go up.
Round 2 – Village chief (bolder, faster, replay ×½):
3. *Steal* – pinches a seed out of your pit as his hand passes. Tell: your pit drops by 1.
4. *House skim* – slips a seed from YOUR house into his. Tell: your house count drops.
5. *Lights-out swap* (horror beat) – lamp flickers, in the dark his pit and yours swap. Tell: counts swapped after the flicker; replay shows his hands in the dark.
Round 2 also has a **red herring**: a legal capture (tembak) that looks like stealing. Tapping it is a wrong tap and costs tape.
Board start also differs: R1 = 3 seeds per pit, R2 = 4 seeds per pit.

**Randomness (27 Oct):** Each opponent has their own pool of cheats. Which cheat they use, and on which of their turns, is picked at random every round and on every retry. Fixed exceptions: round 1's first cheat is always *Extra seed* (it's the tutorial), and round 2 always includes one *Lights-out swap* as a set piece, at a random point. Cheats never repeat back to back. The red herring capture can appear on any of the chief's turns.

**Story clarity (27 Oct):** narration now names the accusation.
- Memory 1: "Her husband is leaving... for war." / "A travelling poet stays in the village. She is kind to him." / "Whispers everywhere... they say she betrayed her husband."
- Memory 2: "Accused of adultery... and the chief wouldn't let her speak." / "They tied her to that tree... to be put to death."
- Reveal adds: "They said I betrayed my husband... with that poet."
**Ending:** Curse → Dawn (Noelle draws a sunrise in wiggly paint) → rolling credits (mockup: assets/mockups/credits_roll.gif). Fill in photo, music/sound and thanks credits before submitting.
