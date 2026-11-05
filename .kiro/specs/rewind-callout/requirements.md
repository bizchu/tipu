# Requirements Document: Rewind and Call-out

Follows the Rewind and Tape health sections of `.kiro/steering/gameplay.md`.

1. DURING the player's turn, THE player SHALL be able to press ◀◀ REW (tape chip or R key) to replay the opponent's last turn; 3 rewinds per round.
2. THE rewind SHALL show VHS tearing, then a slow top-down replay on the flat board (round 1 ×⅓, round 2 ×½) with "Tap when you see something off!".
3. THE cheat SHALL be clearly visible in the replay: a seed from her sleeve (extraSeed), the hand keeping the seed over your hole (skipHole), the hand pinching from your hole/house (steal/houseSkim), or a dark swap (lightsOut).
4. Tapping within the cheat's region while it is visible SHALL be a hit: red TIPU! stamp slams down with a shake, the cheat is undone on the board, the opponent switches to angry and the tell is explained.
5. A wrong tap, letting the cheat pass, or rewinding a clean turn SHALL damage the tape (25% / 25% / 20%).
6. THE tape HUD SHALL show health (red line), shake harder and spin faster as it drops; at 0 the tape snaps ("The tape snapped... ◀◀ REW") and the round restarts.
7. THE same opponent turn SHALL not be rewound twice.
