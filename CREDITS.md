# Credits

All character art, backgrounds, memory photos, UI and story by **Noelle Loh Mei Hui**, unless listed below.

## 3D models
- "Old TV" by danny_p3d: https://sketchfab.com/3d-models/old-tv-3f7bfa2b8d134c4ca2acd395e307f9e6 (CC BY 4.0). File: assets/3d/old_tv.glb
- "VHS player" by Artem P (temp0.crazy): https://sketchfab.com/3d-models/vhs-player-dba56aa822254ab7b6be0a6a2735b42f (CC BY 4.0). File: assets/3d/vhs_player.glb

## Fonts
- Creepster by Sideshow (SIL Open Font License 1.1), via Google Fonts.

## Images
- "Les événements de Siam (L'armée siamoise en marche)", Le Petit Journal, 1893. Public domain. Used in assets/backgrounds/memory3_curse/siam_army_card.png
- Curse card "Rice fire": placeholder made from Noelle's own artwork.
- Curse card "Nothing would grow" (cracked dry land): photo from [Pixabay](https://pixabay.com/photos/drought-dehydrated-clay-floor-earth-1675729/) (Pixabay Content License), given an old-photo treatment. File: assets/game/curse_crops.webp
- Curse card "Seven generations" (mother and child walking away): photo from [Pixabay](https://pixabay.com/photos/mother-child-walking-walk-1077334/) (Pixabay Content License), given an old-photo treatment. File: assets/game/curse_village.webp
- Rooster (dawn scene): AI-generated image "Ayam Hutan" from [Pixabay](https://pixabay.com/illustrations/ayam-hutan-chicken-nature-animal-9756337/) (Pixabay Content License), background removed and flipped. File: assets/game/rooster.webp
- Room and outside backgrounds: original collage / photobash by Noelle Loh Mei Hui.

## Sound
Music and ambience from [Pixabay](https://pixabay.com) (Pixabay Content License: free to use, no attribution required; credited anyway):
- Title music: "Chase Music" by echoes_of_lumen
- Night ambience: "Night Time Crickets and Meditation Tunes" by MeditativeTiger
- Tension layer: "Scary Horror Atmosphere" by Darkne
- Ending music: "Desecrated Horror Piano Ambience" by KonstantinPazuzuStudio
- Battle music (congkak rounds): "Dark Ritual Horror" by FluxSound
- Story music (after the curse): "Cinematic Resolution V2" by SenorMusica81
- Wan Mahora's angry cry: "Angry Female" by Universfield
- Screams under the village chief jump scare: "Scream Horror SFX" by jusatti890

Loops were crossfaded, volume-matched and re-encoded for the web. All other sounds (clicks, seeds, rewind, TIPU! stamp, heartbeat, growl, rooster crow) are synthesised in the browser with the Web Audio API.

## Voices
- Mahsuri, Wan Mahora and the Village Chief: generated with Google Gemini TTS (`gemini-3.1-flash-tts-preview`, via the Gemini API) by `frontend/scripts/make-voices.mjs`. Prebuilt voices: Mahsuri = Zephyr, Wan Mahora = Pulcherrima, Village Chief = Enceladus (ms-MY accent). Style prompts are in `frontend/scripts/voices.config.json`.
- Memory card narrator: voiced by **Noelle Loh Mei Hui**, with noise/echo reduction and an old-radio / tape filter.
- Files: `assets/voice/` (`lines.json` lists every line, who says it and its file).

## Code libraries
- [Phaser 3](https://phaser.io): MIT License
- [Three.js](https://threejs.org): MIT License
- [Vite](https://vitejs.dev), [TypeScript](https://www.typescriptlang.org): MIT / Apache-2.0
- Tests: [Vitest](https://vitest.dev) (MIT), [fast-check](https://fast-check.dev) (MIT)
- Built with [Kiro](https://kiro.dev) (specs and steering in `.kiro/`) and finished with help from Claude (Anthropic).

## Legend
The story follows the Langkawi legend of Mahsuri binti Pandak Mayah (https://en.wikipedia.org/wiki/Mahsuri).
