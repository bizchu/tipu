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

function titleRoot(): HTMLElement | null {
  return document.getElementById('title-root');
}

let titleCancelled = false;

function startTitle(): void {
  HelpButton.hide();
  showTitleScreen({
    onPlay: () => {
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

function openSettings(): void {
  if (document.getElementById('settings-modal')) return;
  let sound = true;
  try {
    sound = localStorage.getItem('tipu.sound') !== 'off';
  } catch {
    /* storage unavailable */
  }
  const m = document.createElement('div');
  m.id = 'settings-modal';
  m.innerHTML = `
    <style>
      #settings-modal{position:fixed;inset:0;z-index:30;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;font-family:"Courier New",monospace}
      #settings-modal .p{background:#140c0a;border:3px solid #d9a54e;padding:32px 40px;color:#f0e6d4;min-width:320px}
      #settings-modal h2{margin:0 0 20px;font-family:Georgia,serif;color:#f6e2b4}
      #settings-modal button{all:unset;cursor:pointer;display:block;margin:12px 0;padding:8px 14px;border:1px solid #6d5a55}
      #settings-modal button:hover,#settings-modal button:focus-visible{border-color:#ff3a2a;color:#ff3a2a}
    </style>
    <div class="p" role="dialog" aria-label="Settings">
      <h2>Settings</h2>
      <button id="s-sound">Sound: ${sound ? 'ON' : 'OFF'}</button>
      <button id="s-close">Close</button>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('#s-sound')!.addEventListener('click', (e) => {
    sound = !sound;
    try {
      localStorage.setItem('tipu.sound', sound ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    (e.target as HTMLElement).textContent = `Sound: ${sound ? 'ON' : 'OFF'}`;
    Sound.setEnabled(sound);
  });
  m.querySelector('#s-close')!.addEventListener('click', () => m.remove());
  (m.querySelector('#s-close') as HTMLElement).focus();
}

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
  titleRoot()?.remove();
  game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
  game.scene.start(t[0], t[1]);
  },
  true,
);
