---
inclusion: always
---
# Gameplay rules

## Mini congkak (pure logic, frontend/src/logic/)
- Each side: 3 holes + 1 house. Houses start empty.
- Round 1 starts with **3 seeds per hole** (18 seeds). Round 2 starts with **4 seeds per hole** (24 seeds).
- **The player (Mahsuri) always moves first.**
- A move: pick up all seeds from one of your own non-empty holes and sow one per hole anticlockwise, including your own house, skipping the opponent's house.
- Last seed in your own house → you take another turn.
- Last seed in a non-empty hole → pick those seeds up and keep sowing.
- Last seed in an empty hole on your side → capture it plus the seeds in the opposite hole into your house (this capture is called *tembak*); turn ends.
- Last seed in an empty hole on the opponent's side → turn ends.
- The game ends when the player to move has no legal move; the most seeds in a house wins. A draw counts as a loss (retry).
- Invariant: a legal move never changes the total number of seeds on the board.

## Cheats (only opponents cheat; Mahsuri is always honest)
Each opponent has a pool. Every round (and every retry), the game picks **which** cheats happen and **on which opponent turns** at random, with these fixed rules:
- **Round 1, Wan Mahora** (sleight of hand, easier to spot, replay at ⅓ speed): pool = *extra seed* (drops 2 seeds into one hole from her sleeve/fan), *skipped hole* (her hand hovers over the player's hole but drops nothing). Her **first cheat is always the extra seed** (tutorial).
- **Round 2, village chief** (bolder, faster, replay at ½ speed): pool = *steal* (pinches a seed out of the player's hole), *house skim* (moves a seed from the player's house to his), *lights-out swap* (lamp flickers, his hole and the player's hole swap contents). **Round 2 always includes exactly one lights-out swap**, at a random point.
- Round 2 also has a **red herring**: a legal *tembak* capture that looks like stealing. Tapping it counts as a wrong tap.
- The same cheat never happens twice in a row. About 2 cheats in round 1, 3 in round 2.
- Every cheat is recorded as an event: type, turn, start/end time in the move animation, and the screen region where it is visible in the replay.

## Rewind (the core VHS mechanic)
- After any opponent move, the player may press **◀◀ REW** (3 per round, shown on the tape HUD chip).
- Rewind zooms into the board with VHS tearing, rewinds, then replays the move slowly from a **top-down** view (congkak_board_flat.png on the room/outside floor). Hands (assets/ui/hands) carry and drop seeds.
- While replaying, a prompt says "Tap when you see something off!"
- Tap inside the cheat region during its visible window → **hit**: red **TIPU!** stamp (assets/ui/tipu_stamp.png) slams down with shake, the cheat is undone, the opponent switches to angry.
- Wrong tap, tapping a clean move, or rewinding a clean move → tape damage.

## Tape health (lives)
- The tape HUD (assets/ui/tape_hud) sits top-right. The red line depletes as health drops; the tape shakes harder; reels spin.
- If health hits 0 the tape snaps → "◀◀ REW" → the round restarts. Losing the congkak game also restarts the round. No separate lose ending.

## Gentle help
- The **?** button (bottom-left) always opens the How to Play slides (assets/ui/howto/slides).
- After 2 wrong clicks, show a short in-world tip and make the ? button pulse.
