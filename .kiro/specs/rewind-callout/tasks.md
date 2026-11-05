# Implementation Plan: Rewind and Call-out

- [x] 1. `frontend/src/ui/Replay.ts`: rewind transition, top-down replay, per-cheat animations, timed hit windows, TIPU! stamp
- [x] 2. BoardScene `onRewind`: rewinds count, undo cheat on hit, angry pose + tell, tape damage on miss / clean / wrong tap
- [x] 3. Tape snap → round restart
- [x] 4. Hit test + tape damage unit tests
- [x] 5. Play-tested: cheat happens, REW replays it, tapping the hole stamps TIPU! and corrects the board
