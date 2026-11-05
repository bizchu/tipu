# Design Document: Story Flow (opening)

## Overview
The title screen is plain Three.js in its own full-window canvas, layered above the Phaser canvas and destroyed on PLAY (`frontend/src/title/TitleScreen.ts`). Everything after that is Phaser scenes.

## Scenes
| Scene | File | Starts next |
|---|---|---|
| (Three.js title) | title/TitleScreen.ts | ChapterCard {chapter:1, next:'Prologue'} |
| ChapterCard | scenes/ChapterCard.ts | `next` with `nextData` |
| Prologue | scenes/Prologue.ts | HowTo {next:'BoardScene', nextData:{round:1}} |
| HowTo | scenes/HowTo.ts | `next`, or resumes `returnTo`, or calls `onClose` |
| BoardScene | scenes/BoardScene.ts | ChapterCard 2 on win (round 1), ToBeContinued (round 2) |

## Shared UI
- `ui/StoryBox.ts`: full-width story box, name tag, typewriter, `say(name, text): Promise<void>`.
- `ui/HelpButton.ts`: DOM ? button, `show / hide / pulse / stopPulse`.
- `ui/Ambience.ts`: animated room (sky sprite sheet, flipping fan, swinging pendulum) and outside sky.
- `ui/TapeHud.ts`: tape health HUD with spinning reels and the REW chip.
- `data/dialogue.json`: prologue lines (with `character:pose` tags) and chapter titles.

## Performance notes
- The title renderer is disposed and its WebGL context released on PLAY.
- No full-screen blur shader in the prologue; a fading dark veil is used instead so low-end GPUs stay smooth.
