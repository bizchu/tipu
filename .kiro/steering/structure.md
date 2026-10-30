---
inclusion: always
---
# Structure

```
.kiro/            steering, specs, hooks (committed, never gitignored)
assets/           all art (served as Vite publicDir)
  3d/             old_tv.glb, vhs_player.glb
  board/          congkak_board.png (angled), congkak_board_flat.png (top-down), congkak_board_start.png, seeds/seed_<colour>.png
  characters/     mahsuri/, wan_mahora/, village_chief/  (<name>_<pose>.png, plus layers/)
  backgrounds/    room/, outside/, memory1*/, memory2_*/, memory3_curse/
  ui/             textbox_story.png, textbox_gameplay.png, nametag.png, tipu_stamp.png, hands/, tape_hud/, howto/slides/
docs/             design-brief.md, kiro-prompts.md, reference/ (layout mockups)
frontend/         Vite + Phaser game (src/logic, src/scenes, src/ui, src/data)
CREDITS.md        every third-party asset with source + licence
```

## Asset naming
lowercase_with_underscores; character poses `<character>_<pose>.png` (poses: normal, confused, scared, calm, annoyed, angry, dead, dead_grey, tied_reveal).
