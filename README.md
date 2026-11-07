# TIPU!

*A cursed VHS tape, a game of congkak, and a lie that won't stay buried.*

A ~4-minute browser horror game for **Kiroween 2026** (category: Resurrection). You wake with no memory at a congkak board. Your opponents cheat. Rewind the tape, catch every lie, stamp it **TIPU!** ("Liar!"), and win back the memories of Mahsuri, the woman Langkawi wronged.

**Play:** https://tipugame.netlify.app (desktop browser, sound on, no login)

## How to play
1. Pick one of your glowing holes; seeds are sown anticlockwise. Land in your house for another turn; land in an empty hole on your side to capture (*tembak*).
2. Your opponent cheats under cover of a flickering lamp. If the numbers look wrong, press **◀◀ REW** (or **R**).
3. Watch the slow-motion replay and **tap the moment they cheat**. A red **TIPU!** stamp undoes it.
4. Wrong taps and empty rewinds damage the tape. If it snaps, the round rewinds. There is no game over.
5. Win both rounds to remember who you are.

The **?** button (bottom-left) opens How to Play at any time.

## Features
- 3D title screen (Three.js): old CRT TV on a VHS player with a glitching, bloody TIPU!
- Two rounds of mini congkak against Wan Mahora and the village chief, with a fully tested rules engine
- Randomised cheats every round and retry (extra seed, skipped hole, steal, house skim, lights-out swap)
- VHS rewind replay with timed tap-to-catch, tape health, tape snap and retry
- Story: prologue, chapter cards, two memory sequences, the chief's dead stare, the reveal, the curse (tap each photo), dawn and rolling credits
- Animated room (twinkling sky, turning fan, swinging clock pendulum), VHS filter that gets heavier in round 2
- All sound synthesised live in the browser (crickets, hum, heartbeat, tape whirr, stamp thunk)

### Demo keys (for judges and the video)
Press **D** then: `1` round 1 · `2` round 2 · `3` prologue · `4` chapter 1 · `5` chapter 2 · `6` how to play · `7` memory 1 · `8` memory 2 · `S` dead stare · `9` reveal · `0` curse · `C` dawn + credits.

## Run locally
```bash
cd frontend
npm install
npm run dev      # play at http://localhost:5173
npm test         # 45 unit + property tests (Vitest + fast-check)
npm run build
```

## Built with
Kiro (steering, specs, hooks) · Phaser 3 · Three.js · Vite · TypeScript · Vitest + fast-check · Netlify

## How Kiro was used
- **Steering** (`.kiro/steering/`): product, tech, structure, gameplay rules, the Mahsuri legend, character voices, visual style and the full script. Every spec and task builds on these.
- **Specs** (`.kiro/specs/`): congkak-rules, board-scene, story-flow, opponent-cheats, rewind-callout, memories-and-reveal, vhs-effects-and-sound, each with requirements, design and tasks.
- The congkak rules engine and the first half of the board scene were implemented by Kiro from those specs. After the free Kiro credits ran out, the remaining tasks were implemented with another AI assistant, following the same Kiro specs and steering.

## Credits
See [CREDITS.md](CREDITS.md). Code licence: MIT. Third-party assets keep their own licences.
