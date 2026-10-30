---
inclusion: always
---
# Tech

- **frontend/**: Vite + TypeScript (strict) + **Phaser 3**. All game code lives here.
- **Assets** live in the repo-root `assets/` folder. Configure Vite with `publicDir: '../assets'` (or an alias) so they are served as `/…`. Never move or rename files in `assets/` without updating the loader.
- **Three.js** only for the title screen (old TV + VHS player .glb models, CD stack built in code, red screen glow, glitching "TIPU!" in the Creepster font). Render it in its own canvas, then hand over to Phaser when PLAY is pressed.
- **Tests:** Vitest for unit tests, **fast-check** for property-based tests of the congkak rules (e.g. legal sowing never changes the total seed count).
- **No backend required.** Optional later: a tiny Node endpoint for AI taunts / text-to-speech, with keys only in env vars and a scripted fallback.
- **Hosting:** static build (`npm run build` → `frontend/dist`), deployed to GitHub Pages or Netlify.

## Conventions
- Game logic (rules, cheats, replay data) is pure TypeScript in `frontend/src/logic/` with no Phaser imports, so it can be unit-tested.
- Scenes in `frontend/src/scenes/`, one file per scene, named after the flow in product.md.
- All dialogue and on-screen text comes from `frontend/src/data/dialogue.json` (not hard-coded in scenes).
- Base resolution 1920×1080, `Phaser.Scale.FIT`, centred.
- Text in text boxes must word-wrap to fit; name tags shrink long names to fit.
- Keep files small and readable; prefer clear names over clever code.
- A hidden demo key (e.g. `D` then 1–9) jumps to any scene, for the demo video and judges.
