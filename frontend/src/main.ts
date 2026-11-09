import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import BoardScene from './scenes/BoardScene';
import ChapterCard from './scenes/ChapterCard';
import Prologue from './scenes/Prologue';
import HowTo from './scenes/HowTo';
import ToBeContinued from './scenes/ToBeContinued';
import Memory from './scenes/Memory';
import Reveal from './scenes/Reveal';
import Curse from './scenes/Curse';
import Dawn from './scenes/Dawn';
import Credits from './scenes/Credits';
import DeadStare from './scenes/DeadStare';
import { showTitleScreen } from './title/TitleScreen';
import { HelpButton } from './ui/HelpButton';
import { Sound } from './audio/Sound';
import { openSettings, SettingsButton } from './ui/Settings';

/**
 * Entry point. Base resolution 1920×1080, scaled to fit the window (letterboxed).
 * Flow: 3D title → Chapter 1 card → Prologue → How to Play → Round 1 → Chapter 2 card → Round 2 → …
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  backgroundColor: '#000000',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, ChapterCard, Prologue, HowTo, BoardScene, DeadStare, Memory, Reveal, Curse, Dawn, Credits, ToBeContinued],
};

// Creepster is used by the title TV and the credits
new FontFace('Creepster', 'url(/fonts/creepster.woff2)').load().then((f) => document.fonts.add(f)).catch(() => undefined);

const game = new Phaser.Game(config);
(window as unknown as { __tipu: Phaser.Game }).__tipu = game;

// click sound for anything tappable inside the game canvas (holes, CONTINUE, REW, cards…)
game.events.once(Phaser.Core.Events.READY, () => {
  game.scene.scenes.forEach((s) =>
    s.sys.events.on(Phaser.Scenes.Events.CREATE, () => s.input.on(Phaser.Input.Events.GAMEOBJECT_DOWN, () => Sound.click())),
  );
});

function titleRoot(): HTMLElement | null {
  return document.getElementById('title-root');
}

let titleCancelled = false;

function startTitle(): void {
  HelpButton.hide();
  // title music: starts with the first click/key (browser rule) and fades in
  Sound.music('title', { vol: 0.45, fade: 3, loop: true });
  showTitleScreen({
    onKnob: () => {
      Sound.unlock();
      Sound.click();
    },
    onVolume: (v) => Sound.setVolume('ambience', v),
    onPlay: () => {
      enterGame();
      Sound.stopMusic(2);
      Sound.glitch();
      game.scene.start('ChapterCard', { chapter: 1, next: 'Prologue' });
    },
    onHowTo: () => {
      const root = titleRoot();
      if (root) root.style.display = 'none';
      game.scene.start('HowTo', {
        onClose: () => {
          const r = titleRoot();
          if (r) r.style.display = '';
        },
      });
    },
    onSettings: openSettings,
  }).then((destroy) => {
    if (titleCancelled) destroy();
  }).catch((err) => {
    console.error('Title screen failed, starting game directly', err);
    titleRoot()?.remove();
    game.scene.start('ChapterCard', { chapter: 1, next: 'Prologue' });
  });
}

// Once the game has started, refreshing or closing the tab asks "are you sure?"
// (browsers show their own wording, e.g. "Leave site? Changes may not be saved").
let inGame = false;
function enterGame(): void {
  inGame = true;
  SettingsButton.show(game);
}
window.addEventListener('beforeunload', (e) => {
  if (!inGame) return;
  e.preventDefault();
  e.returnValue = '';
});
// Esc opens Settings at any time once the game has started
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && inGame && !document.getElementById('settings-modal')) openSettings();
});
/** lets PLAY AGAIN reload without the prompt */
(window as unknown as { __tipuLeave: () => void }).__tipuLeave = () => {
  inGame = false;
};

startTitle();

// ---------------------------------------------------------------------------
// Demo keys: press D then a digit within 1 s to jump around (for testing and the demo video).
//   D1 round 1 · D2 round 2 · D3 prologue · D4 chapter 1 card · D5 chapter 2 card · D6 how to play
//   D7 memory 1 · D8 memory 2 · D9 reveal · D0 curse · DC dawn + credits
// ---------------------------------------------------------------------------
let dPressedAt = -Infinity;
window.addEventListener(
  'keydown',
  (e) => {
  const key = e.key.toLowerCase();
  if (key === 'd') {
    dPressedAt = performance.now();
    return;
  }
  if (performance.now() - dPressedAt > 1000) return;
  const targets: Record<string, [string, object]> = {
    '1': ['BoardScene', { round: 1 }],
    '2': ['BoardScene', { round: 2 }],
    '3': ['Prologue', {}],
    '4': ['ChapterCard', { chapter: 1, next: 'Prologue' }],
    '5': ['ChapterCard', { chapter: 2, next: 'BoardScene', nextData: { round: 2 } }],
    '6': ['HowTo', { next: 'BoardScene', nextData: { round: 1 } }],
    '7': ['Memory', { set: 1 }],
    '8': ['Memory', { set: 2 }],
    '9': ['Reveal', {}],
    '0': ['Curse', {}],
    c: ['Dawn', {}],
    s: ['DeadStare', {}],
  };
  const t = targets[key];
  if (!t) return;
  dPressedAt = -Infinity;
  titleCancelled = true;
  enterGame();
  Sound.stopMusic(1);
  titleRoot()?.remove();
  game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
  game.scene.start(t[0], t[1]);
  },
  true,
);
