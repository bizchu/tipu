---
inclusion: always
---
# Product: Main Lagi (working title)

A ~4-minute browser horror game for the **Kiroween 2026** hackathon (category: Resurrection; backup: Costume Contest).

## Pitch
You wake with no memory in a dark kampung house, facing a congkak board. Two people from the village play mini congkak against you, and they cheat. When something looks wrong, you rewind the VHS tape, watch their move again in slow motion and tap the exact moment they cheated. A red **TIPU!** ("Liar!") stamp slams down. Every round you win gives back a memory, until you realise who you are: **Mahsuri**, the wronged woman of the Langkawi legend.

## Player experience goals
- Understandable in 10 seconds, finished in about 4 minutes.
- **No game over.** Losing a round or snapping the tape rewinds the tape and you retry the round.
- Creepy, sad and respectful. Never gory.
- The rewind is both the mechanic and the theme: you rewind the past to find the truth.

## Scene flow (in order)
1. Title screen (3D TV + VCR, menu: PLAY / HOW TO PLAY / SETTINGS, no title text)
2. Chapter 1 card (spinning tape)
3. Prologue: Mahsuri wakes up, Wan Mahora invites her to play
4. How to Play overlay (also always available from the **?** button, bottom-left)
5. Round 1 vs Wan Mahora (indoor room)
6. Memory 1 (4 photo cards on a wooden table)
7. Chapter 2 card
8. Round 2 vs the village chief (outside at night, top-down mat on sand)
9. Memory 2 (3 photo cards on the sand ground)
10. Reveal (zoom into the tree photo, glitch, white flash, tied Mahsuri crying white tears)
11. The curse (4 photos pop in; player taps each to read what happened; Continue unlocks after all 4)
12. Dawn (sunrise, hand-painted)
13. Rolling credits ending on THE END

Full script: `.kiro/steering/story.md`. Design history: `docs/design-brief.md`.

## Out of scope for the hackathon
Online play, accounts, saving progress, mobile-first layout (desktop browser first; it should still scale down).
