# Implementation Plan: Opponent Cheats

- [x] 1. `frontend/src/logic/cheats.ts`: CheatType, pools, `planCheats`, `playOpponentMove`, tells
- [x] 2. Property tests: plan rules (first cheat, one lightsOut, no repeats, randomness), seed totals, cheats always favour the opponent
- [x] 3. BoardScene: `runOpponentMove` uses the plan, defers cheats that can't apply, lamp flicker in live play
- [x] 4. Tutorial hint for the first cheat
