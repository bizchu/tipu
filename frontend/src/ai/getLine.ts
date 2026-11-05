const backup = {
  caught: ["Tch... clever girl.", "Such sharp eyes, sayang."],
  capture: ["Mine now, sayang.", "Did you see that coming?"],
};

export async function getLine(character: string, event: keyof typeof backup) {
  const timeout = new AbortController();
  setTimeout(() => timeout.abort(), 2000);           // give up after 2 seconds
  try {
    const res = await fetch("/.netlify/functions/taunt", {
      method: "POST",
      body: JSON.stringify({ character, event }),
      signal: timeout.signal,
    });
    return (await res.json()).line;
  } catch {
    const lines = backup[event];                     // AI failed → use a scripted line
    return lines[Math.floor(Math.random() * lines.length)];
  }
}