# Requirements Document: Opponent Cheats

Follows the Cheats section of `.kiro/steering/gameplay.md`.

1. THE game SHALL plan cheats at random every round and every retry (`planCheats(round, rand)`).
2. Round 1 (Wan Mahora) SHALL have 2 cheats from {extraSeed, skipHole}; the first SHALL always be extraSeed.
3. Round 2 (village chief) SHALL have 3 cheats from {steal, houseSkim, lightsOut} with exactly one lightsOut.
4. THE same cheat SHALL never happen twice in a row.
5. A cheat SHALL be applied on top of a legal opponent move (`playOpponentMove`) and recorded as a CheatEvent (type, step index or after-move, hole to tap).
6. IF a cheat cannot apply on the current board (e.g. empty house for houseSkim), it SHALL move to the opponent's next turn.
7. Every cheat SHALL hurt the player or help the opponent; only extraSeed changes the seed total (+1).
8. In live play each cheat SHALL be covered by a lamp flicker (lightsOut: a longer, darker blackout).
9. The first cheat of round 1 SHALL be pointed out ("Wait... that doesn't look right. Press ◀◀ REW") with the REW chip pulsing; later cheats SHALL not be pointed out.
