#!/usr/bin/env node
/**
 * Generates the voice lines with Google Cloud Text-to-Speech.
 *
 *   npm run voices              make any missing / changed lines
 *   npm run voices -- --dry     just list the lines, no API calls
 *   npm run voices -- --only=chief,woman   only these characters
 *   npm run voices -- --force   remake every generated line
 *   npm run voices -- --chirp   fill gaps with Chirp 3 HD voices (no daily cap, no style prompts)
 *
 * Needs a key in frontend/.env (never commit that file):
 *   GEMINI_API_KEY=...       when voices.config.json has "provider": "gemini" (free tier, aistudio.google.com/apikey)
 *   GOOGLE_TTS_API_KEY=...   when "provider": "cloud" (Cloud Text-to-Speech)
 * Voices and style prompts are in scripts/voices.config.json ("lineStyles" overrides the
 * style for single lines by id; "keep" lists ids whose current take must never be remade).
 *
 * Output: assets/voice/<id>.mp3, assets/voice/manifest.json (text -> file, read
 * by the game) and assets/voice/lines.json (every line, who says it, its file).
 *
 * Your own recordings: save them in assets/voice/ with the line's id as the
 * name (e.g. memory1_01.m4a; ids are in lines.json). Files this script didn't
 * make are never overwritten, and they win over generated ones.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(here, '..');
const OUT = join(FRONTEND, '..', 'assets', 'voice');
const GENERATED = join(OUT, '.generated.json');
const EXTS = ['m4a', 'mp3', 'wav', 'ogg']; // own recordings may be any of these
const ENDPOINT = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');
const ONLY = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);

/** Must match voiceKey() in src/audio/Voice.ts */
const voiceKey = (t) => t.trim().toLowerCase().replace(/\s+/g, ' ');
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const pad = (n) => String(n + 1).padStart(2, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. collect every line and who says it ----------
const dialogue = json(join(FRONTEND, 'src/data/dialogue.json'));
const board = json(join(FRONTEND, 'src/data/boardLines.json'));
const config = json(join(here, 'voices.config.json'));

const SPEAKER = { '???': 'mahsuri', Mahsuri: 'mahsuri', 'The Woman': 'woman', 'Wan Mahora': 'woman', 'Village Chief': 'chief' };
const lines = [];
const add = (id, section, speaker, text) => {
  if (!text || !/[a-z]/i.test(text)) return; // skip "..." etc.
  if (!config.characters[speaker]) throw new Error(`No voice set for "${speaker}" in voices.config.json`);
  lines.push({ id, section, speaker, text });
};

dialogue.prologue.forEach((l, i) => add(`prologue_${pad(i)}`, 'prologue', SPEAKER[l.name], l.text));
dialogue.memory1.forEach((l, i) => add(`memory1_${pad(i)}`, 'memory', 'narrator', l.text));
dialogue.memory2.forEach((l, i) => add(`memory2_${pad(i)}`, 'memory', 'narrator', l.text));
dialogue.reveal.forEach((l, i) => add(`reveal_${pad(i)}`, 'reveal', SPEAKER[l.name], l.text));
dialogue.curse.forEach((c) => c.lines.forEach((t, i) => add(`curse_${c.card}_${pad(i)}`, 'curse', 'mahsuri', t)));
add('curse_end', 'curseEnd', 'mahsuri', dialogue.curseEnd);
add('dawn', 'dawn', 'mahsuri', dialogue.dawn);
dialogue.deadStare.forEach((l, i) => add(`deadstare_${pad(i)}`, 'deadStare', SPEAKER[l.name], l.text));

const OPP = { wan_mahora: ['woman', 'wan'], village_chief: ['chief', 'chief'] };
for (const [opp, groups] of Object.entries(board.lines)) {
  const [speaker, tag] = OPP[opp];
  for (const [event, v] of Object.entries(groups)) {
    (Array.isArray(v) ? v : [v]).forEach((t, i) => add(`board_${tag}_${event}_${pad(i)}`, 'board', speaker, t));
  }
  add(`board_${tag}_intro`, 'board', speaker, board.intro[opp]);
}
board.wanMahoraLoses.lines.forEach((t, i) => add(`board_wan_lose_${pad(i)}`, 'board', 'woman', t));
add('board_wan_lose_final', 'board', 'woman', board.wanMahoraLoses.final);

// the game finds clips by text, so the same text must always be the same speaker
const seen = new Map();
for (const l of lines) {
  const k = voiceKey(l.text);
  const prev = seen.get(k);
  if (prev && prev.speaker !== l.speaker) console.warn(`⚠ "${l.text}" is said by both ${prev.speaker} and ${l.speaker}; using ${prev.speaker}`);
  if (!prev) seen.set(k, l);
}

// ---------- 2. generate ----------
function settingsFor(l, styleOverride) {
  const c = config.characters[l.speaker];
  const style = styleOverride ?? config.lineStyles?.[l.id] ?? c.sectionStyles?.[l.section] ?? c.style ?? '';
  return { model: c.model ?? config.model, voice: c.voice, languageCode: c.languageCode, style };
}
const hashOf = (l) => createHash('sha1').update(JSON.stringify([l.text, settingsFor(l)])).digest('hex').slice(0, 12);
const existing = (id) => EXTS.map((e) => `${id}.${e}`).find((f) => existsSync(join(OUT, f)));

// --chirp: use Cloud Text-to-Speech Chirp 3 HD voices instead (same voice names, no daily cap, but ignores style prompts)
const CHIRP = args.includes('--chirp');
const PROVIDER = CHIRP ? 'cloud' : config.provider ?? 'cloud'; // 'gemini' = Gemini API (AI Studio key), 'cloud' = Cloud Text-to-Speech
const KEY_NAME = PROVIDER === 'gemini' ? 'GEMINI_API_KEY' : 'GOOGLE_TTS_API_KEY';

function loadKey() {
  if (process.env[KEY_NAME]) return process.env[KEY_NAME];
  const envPath = join(FRONTEND, '.env');
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, 'utf8').match(new RegExp(`^\\s*${KEY_NAME}\\s*=\\s*["']?([^"'\\s]+)`, 'm'));
    if (m) return m[1];
  }
  console.error(`Missing ${KEY_NAME}. Add a line to frontend/.env:\n  ${KEY_NAME}=your-key-here`);
  process.exit(1);
}

/** POSTs with retries on rate limits / server errors (honours Google's suggested retry delay). */
async function post(url, headers, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    const msg = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 8) {
      const hint = Number(msg.match(/"retryDelay":\s*"(\d+)/)?.[1] ?? 0);
      if (hint > 300) {
        // not a per-minute limit: the daily quota is used up
        const err = new Error(`daily limit reached, try again in about ${Math.ceil(hint / 3600)} hours (or use a key with billing)`);
        err.status = 429;
        err.daily = true;
        throw err;
      }
      const wait = Math.max(hint * 1000 + 1000, 8000 * attempt);
      console.log(`   busy (${res.status}), waiting ${Math.round(wait / 1000)}s...`);
      await sleep(wait);
      continue;
    }
    const err = new Error(`${res.status}: ${msg.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
}

/** 16-bit mono PCM -> WAV file bytes */
function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

let geminiLang = true; // dropped if the Gemini API rejects languageCode
/** Returns { audio: Buffer, ext } */
async function synth(l, key, styleOverride) {
  const s = settingsFor(l, styleOverride);
  if (PROVIDER === 'gemini') {
    const prompt = s.style ? `### DIRECTOR'S NOTES\n${s.style}\n\n### TRANSCRIPT\n${l.text}` : l.text;
    const speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voice } } };
    if (geminiLang && s.languageCode) speechConfig.languageCode = s.languageCode;
    let data;
    try {
      data = await post(`https://generativelanguage.googleapis.com/v1beta/models/${s.model}:generateContent`, { 'x-goog-api-key': key }, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig },
      });
    } catch (e) {
      if (e.status === 400 && geminiLang && /language/i.test(e.message)) {
        geminiLang = false; // accent comes from the style prompt instead
        return synth(l, key, styleOverride);
      }
      throw e;
    }
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) {
      const reason = data.candidates?.[0]?.finishReason ?? 'unknown';
      throw new Error(`no audio returned (${reason}). Usually a one-off: run again, or reword the line / style slightly.`);
    }
    const rate = Number(part.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24000);
    return { audio: wav(Buffer.from(part.inlineData.data, 'base64'), rate), ext: 'wav' };
  }
  const body = CHIRP
    ? {
        input: { text: l.text },
        voice: { languageCode: s.languageCode, name: `${s.languageCode}-Chirp3-HD-${s.voice}` },
        audioConfig: { audioEncoding: 'MP3' },
      }
    : {
        input: s.style ? { prompt: s.style, text: l.text } : { text: l.text },
        voice: { languageCode: s.languageCode, name: s.voice, modelName: s.model },
        audioConfig: { audioEncoding: 'MP3' },
      };
  const data = await post(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {}, body);
  return { audio: Buffer.from(data.audioContent, 'base64'), ext: 'mp3' };
}

/** On a Mac, shrink WAV to AAC (.m4a) with the built-in afconvert; elsewhere keep the WAV. */
function compress(wavPath) {
  if (process.platform !== 'darwin') return wavPath;
  const out = wavPath.replace(/\.wav$/, '.m4a');
  const r = spawnSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', wavPath, out]);
  if (r.status !== 0) return wavPath;
  unlinkSync(wavPath);
  return out;
}

const todo = lines.filter((l) => seen.get(voiceKey(l.text)) === l && (!ONLY.length || ONLY.includes(l.speaker)));
console.log(`${lines.length} voice lines (${todo.length} selected)\n`);
if (DRY) {
  for (const l of todo) console.log(`${l.id.padEnd(28)} ${l.speaker.padEnd(9)} ${l.text}`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const generated = existsSync(GENERATED) ? json(GENERATED) : {};
let key = null; // only needed if something actually has to be generated
let made = 0;
let failed = 0;
for (const l of todo) {
  const file = existing(l.id);
  const mine = file && generated[l.id]?.file === file;
  if (file && !mine) {
    console.log(`  ${l.id}: your own recording, kept`);
    const old = generated[l.id]?.file;
    if (old && old !== file && existsSync(join(OUT, old))) unlinkSync(join(OUT, old)); // drop the generated one it replaced
    delete generated[l.id];
    continue;
  }
  if (mine && config.keep?.includes(l.id)) continue; // you liked this take: never remake it
  if (mine && !FORCE && generated[l.id].hash === hashOf(l)) continue;
  key ??= loadKey();
  process.stdout.write(`  ${l.id} (${l.speaker}): ${l.text}\n`);
  try {
    // Gemini TTS sometimes refuses a line ("SAFETY"), often because of the style prompt.
    // Try the normal style 3 times, then the character's gentler fallbackStyle, then no style at all.
    const fallback = config.characters[l.speaker].fallbackStyle;
    const attempts = [undefined, undefined, undefined, ...(fallback ? [fallback, fallback] : []), ''];
    let res;
    for (let i = 0; ; i++) {
      try {
        res = await synth(l, key, attempts[i]);
        if (attempts[i] !== undefined) console.log(attempts[i] ? '   (made with the fallback style)' : '   (made with no style prompt)');
        break;
      } catch (e) {
        if (i >= attempts.length - 1 || !/no audio returned/.test(e.message)) throw e;
        console.log(attempts[i + 1] === undefined ? '   no audio, retrying...' : attempts[i + 1] ? '   no audio, trying the fallback style...' : '   no audio, trying without a style prompt...');
        await sleep(3000);
      }
    }
    const { audio, ext } = res;
    let path = join(OUT, `${l.id}.${ext}`);
    writeFileSync(path, audio);
    if (ext === 'wav') path = compress(path);
    const name = path.split(/[\\/]/).pop();
    if (file && file !== name && existsSync(join(OUT, file))) unlinkSync(join(OUT, file));
    generated[l.id] = { file: name, hash: hashOf(l) };
    writeFileSync(GENERATED, JSON.stringify(generated, null, 2) + '\n');
    made++;
  } catch (e) {
    failed++;
    console.error(`   ✗ failed: ${e.message}`);
    if (e.daily || e.status === 400 || e.status === 401 || e.status === 403) {
      console.error(e.daily ? '\nStopping for today. Everything made so far is saved; run `npm run voices` again later to continue.' : '\nStopping: this looks like a key or settings problem, not a one-off.');
      break;
    }
  }
  await sleep(PROVIDER === 'gemini' ? 6500 : 1200); // stay under the free tier's requests-per-minute
}

// ---------- 3. manifest (every line that has a file, generated or recorded) ----------
const manifest = {};
const list = [];
for (const l of lines) {
  const file = existing(l.id);
  list.push({ ...l, file: file ?? null });
  if (file && seen.get(voiceKey(l.text)) === l) manifest[voiceKey(l.text)] = file;
}
// tidy: drop generated files for lines that no longer exist
for (const f of readdirSync(OUT)) {
  const id = f.replace(/\.[^.]+$/, '');
  if (generated[id] && !lines.some((l) => l.id === id)) {
    unlinkSync(join(OUT, f));
    delete generated[id];
  }
}
writeFileSync(GENERATED, JSON.stringify(generated, null, 2) + '\n');
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(OUT, 'lines.json'), JSON.stringify(list, null, 2) + '\n');
console.log(`\nDone: ${made} made, ${failed} failed, ${Object.keys(manifest).length}/${seen.size} lines have a voice.`);
if (failed) process.exitCode = 1;
