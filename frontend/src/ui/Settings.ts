import Phaser from 'phaser';
import { Sound } from '../audio/Sound';

/**
 * Settings panel (sound on/off, ambience volume, sound-effects volume) plus an
 * always-visible ⚙ button so it can be opened at any time during the game.
 * Opening it pauses whatever scene is running; closing resumes it.
 */
let game: Phaser.Game | null = null;
let btn: HTMLButtonElement | null = null;

function soundOn(): boolean {
  try {
    return localStorage.getItem('tipu.sound') !== 'off';
  } catch {
    return true;
  }
}

export function openSettings(): void {
  if (document.getElementById('settings-modal')) return;
  let sound = soundOn();

  // pause the running scenes while the panel is open
  const paused: Phaser.Scene[] = game ? game.scene.getScenes(true) : [];
  paused.forEach((s) => s.scene.pause());

  const pct = (v: number) => Math.round(v * 100);
  const m = document.createElement('div');
  m.id = 'settings-modal';
  m.innerHTML = `
    <style>
      #settings-modal{position:fixed;inset:0;z-index:30;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;font-family:"Courier New",monospace}
      #settings-modal .p{background:#140c0a;border:3px solid #d9a54e;padding:32px 40px;color:#f0e6d4;min-width:340px;max-width:90vw}
      #settings-modal h2{margin:0 0 20px;font-family:Georgia,serif;color:#f6e2b4}
      #settings-modal button{all:unset;cursor:pointer;display:block;margin:12px 0;padding:8px 14px;border:1px solid #6d5a55}
      #settings-modal button:hover,#settings-modal button:focus-visible{border-color:#ff3a2a;color:#ff3a2a}
      #settings-modal label{display:block;margin:18px 0 6px}
      #settings-modal .row{display:flex;align-items:center;gap:12px}
      #settings-modal input[type=range]{flex:1;accent-color:#d9a54e;height:28px}
      #settings-modal .v{width:3.5em;text-align:right}
      #settings-modal .dim{opacity:.4}
      #settings-modal h3{margin:26px 0 8px;font-family:Georgia,serif;color:#f6e2b4;font-size:20px}
      #settings-modal table{border-collapse:collapse;font-size:15px;width:100%}
      #settings-modal td{padding:5px 0;vertical-align:top}
      #settings-modal td:first-child{padding-right:18px;color:#d9a54e;white-space:nowrap}
      #settings-modal .p{max-height:90vh;overflow:auto}
    </style>
    <div class="p" role="dialog" aria-label="Settings">
      <h2>Settings</h2>
      <button id="s-sound">Sound: ${sound ? 'ON' : 'OFF'}</button>
      <div id="s-sliders" class="${sound ? '' : 'dim'}">
        <label for="s-amb">Background &amp; music</label>
        <div class="row"><input id="s-amb" type="range" min="0" max="100" value="${pct(Sound.volume('ambience'))}"><span class="v" id="s-amb-v">${pct(Sound.volume('ambience'))}%</span></div>
        <label for="s-sfx">Sound effects (clicks, seeds, rewind, TIPU!)</label>
        <div class="row"><input id="s-sfx" type="range" min="0" max="100" value="${pct(Sound.volume('sfx'))}"><span class="v" id="s-sfx-v">${pct(Sound.volume('sfx'))}%</span></div>
      </div>
      <h3>Controls</h3>
      <table>
        <tr><td>Continue story</td><td>Tap / click, or Space / Enter</td></tr>
        <tr><td>Play a hole</td><td>Tap / click one of your 3 holes</td></tr>
        <tr><td>Rewind the tape</td><td>◀◀ REW (top-right) or R</td></tr>
        <tr><td>Catch the cheat</td><td>Tap the board the moment something looks wrong in the replay</td></tr>
        <tr><td>Speed up moves</td><td>Hold Space during a round</td></tr>
        <tr><td>How to play</td><td>? button (bottom-left)</td></tr>
        <tr><td>Settings</td><td>⚙ button (top-left) or Esc</td></tr>
      </table>
      <button id="s-close">Close</button>
    </div>`;
  document.body.appendChild(m);

  const q = <T extends HTMLElement>(sel: string) => m.querySelector(sel) as T;
  q<HTMLButtonElement>('#s-sound').addEventListener('click', (e) => {
    sound = !sound;
    try {
      localStorage.setItem('tipu.sound', sound ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    (e.target as HTMLElement).textContent = `Sound: ${sound ? 'ON' : 'OFF'}`;
    q('#s-sliders').className = sound ? '' : 'dim';
    Sound.setEnabled(sound);
  });
  const amb = q<HTMLInputElement>('#s-amb');
  amb.addEventListener('input', () => {
    Sound.setVolume('ambience', Number(amb.value) / 100);
    q('#s-amb-v').textContent = `${amb.value}%`;
  });
  const sfx = q<HTMLInputElement>('#s-sfx');
  sfx.addEventListener('input', () => {
    Sound.setVolume('sfx', Number(sfx.value) / 100);
    q('#s-sfx-v').textContent = `${sfx.value}%`;
  });
  sfx.addEventListener('change', () => Sound.tick()); // a sample so you hear the new level

  const close = () => {
    m.remove();
    window.removeEventListener('keydown', onKey, true);
    paused.forEach((s) => s.scene.resume());
    btn?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      close();
    }
  };
  window.addEventListener('keydown', onKey, true);
  m.addEventListener('click', (e) => {
    if (e.target === m) close();
  });
  q('#s-close').addEventListener('click', close);
  q<HTMLButtonElement>('#s-close').focus();
}

export const SettingsButton = {
  show(g: Phaser.Game): void {
    game = g;
    if (!btn) {
      const style = document.createElement('style');
      style.textContent = `
        #settings-btn{position:fixed;left:max(16px,2vw);top:max(16px,3vh);z-index:15;width:52px;height:52px;border-radius:50%;
          background:#1a100c;color:#f6e2b4;border:3px solid #d9a54e;font:28px/1 Georgia,serif;cursor:pointer;opacity:.85;
          box-shadow:0 4px 14px rgba(0,0,0,.6)}
        #settings-btn:hover{opacity:1;background:#2a1a12}
        #settings-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}`;
      document.head.appendChild(style);
      btn = document.createElement('button');
      btn.id = 'settings-btn';
      btn.textContent = '⚙';
      btn.setAttribute('aria-label', 'Settings');
      btn.addEventListener('click', openSettings);
      document.body.appendChild(btn);
    }
    btn.style.display = 'block';
  },
  hide(): void {
    if (btn) btn.style.display = 'none';
  },
};
