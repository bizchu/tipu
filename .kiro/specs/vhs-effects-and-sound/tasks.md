# Implementation Plan: VHS Effects and Sound

Follows `.kiro/steering/style.md`.

- [x] 1. `ui/VhsFilter.ts`: scanlines, moving grain, vignette, random tracking bands; level 0 (round 1) / level 1 (round 2, red-edged vignette, more bands). No tint on characters.
- [x] 2. `audio/Sound.ts`: all sound synthesised with Web Audio (no files to license): crickets, room hum, heartbeat layers; seed tick, tape whirr, TIPU! thunk, glitch, tape hurt, lamp flicker, page turn, dawn chime.
- [x] 3. Sound starts after the first click/key and follows the Settings toggle.
- [x] 4. Moods per scene: room = crickets + hum; round 2 adds a heartbeat; heartbeat speeds up as the tape is damaged; reveal = heartbeat then silence; dawn = soft crickets + chime.
- [ ] 5. Optional: recorded whispers / laughs for extra creepiness (needs licensed or self-recorded audio).
