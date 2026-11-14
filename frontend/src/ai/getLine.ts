/**
 * Live AI taunts: asks the Netlify function (Gemini) for one in-character line.
 * Always has a scripted fallback, so the game never waits more than ~2 s and
 * works offline / locally / if the API is down.
 */
const CHARACTER = { wan_mahora: 'Wan Mahora', village_chief: 'Village chief' } as const;
let calls = 0;
const MAX_CALLS = 8; // per page load, keeps API use small

export async function getLine(opponent: keyof typeof CHARACTER, event: string, fallback: readonly string[]): Promise<string> {
  const scripted = fallback[Math.floor(Math.random() * fallback.length)];
  if (calls >= MAX_CALLS || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return scripted;
  calls++;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000); // give up after 2 seconds
  try {
    const res = await fetch('/.netlify/functions/taunt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ character: CHARACTER[opponent], event }),
      signal: ctrl.signal,
    });
    if (!res.ok) return scripted;
    const line = String((await res.json()).line ?? '')
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .trim();
    // keep it short and on-screen friendly; otherwise use the scripted line
    return line && line.length <= 90 && !line.includes('\n') ? line : scripted;
  } catch {
    return scripted;
  } finally {
    clearTimeout(timer);
  }
}
