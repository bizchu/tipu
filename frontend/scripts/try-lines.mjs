#!/usr/bin/env node
/**
 * One-off helper: Gemini TTS keeps refusing two of Wan Mahora's losing lines.
 * Tries alternative wordings one at a time (updating boardLines.json and running
 * make-voices.mjs) and keeps the first wording that gets a voice.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BOARD = join(here, '../src/data/boardLines.json');
const LINES = join(here, '../../assets/voice/lines.json');

const SLOTS = [
  { id: 'board_wan_lose_03', index: 2, options: ['Clever little thing, aren\'t you?', 'Oh, so now you think you\'re clever.', 'Such a clever one, hmm?', 'How very clever of you.'] },
  { id: 'board_wan_lose_04', index: 3, options: ['So you still want your memories back?', 'Still so eager to remember?', 'You still want to know?', 'Very well, then.'] },
];

const hasVoice = (id) => JSON.parse(readFileSync(LINES, 'utf8')).find((l) => l.id === id)?.file;

for (const slot of SLOTS) {
  if (hasVoice(slot.id)) {
    console.log(`${slot.id}: already has a voice`);
    continue;
  }
  for (const text of slot.options) {
    const board = JSON.parse(readFileSync(BOARD, 'utf8'));
    board.wanMahoraLoses.lines[slot.index] = text;
    writeFileSync(BOARD, JSON.stringify(board, null, 2) + '\n');
    console.log(`${slot.id}: trying "${text}"`);
    spawnSync('node', [join(here, 'make-voices.mjs'), '--only=woman'], { stdio: 'ignore' });
    if (hasVoice(slot.id)) {
      console.log('   ✓ worked');
      break;
    }
    console.log('   ✗ refused');
  }
}
const missing = JSON.parse(readFileSync(LINES, 'utf8')).filter((l) => !l.file).length;
console.log(`\n${76 - missing}/76 lines have a voice.`);
console.log('Her losing speech is now:\n  ' + JSON.parse(readFileSync(BOARD, 'utf8')).wanMahoraLoses.lines.concat("Fine. I'll show you.").join('\n  '));
