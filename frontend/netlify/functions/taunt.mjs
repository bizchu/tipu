// One short in-character taunt from Gemini. The game falls back to scripted
// lines if this fails, so errors just return 500.
export default async (req) => {
  try {
    const { character, event } = await req.json();
    const who = character === 'Village chief' ? 'Village chief' : 'Wan Mahora';
    const what = String(event ?? '').slice(0, 200);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are ${who} in a Malaysian horror congkak game set in 1820s Langkawi, playing against Mahsuri.
Wan Mahora: the village chief's wife, sweet on the surface, calls the player "sayang", jealous and cold when caught.
Village chief: cold, formal, speaks like a judge.
Reply with ONE line under 12 words, in English (a Malay word like sayang is fine). No quotes, no narration, no emojis.`,
            }],
          },
          contents: [{ parts: [{ text: `What just happened: ${what}` }] }],
          generationConfig: { maxOutputTokens: 40, temperature: 0.9 },
        }),
      },
    );
    if (!res.ok) return new Response('upstream error', { status: 500 });
    const data = await res.json();
    const line = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!line) return new Response('no line', { status: 500 });
    return Response.json({ line });
  } catch {
    return new Response('bad request', { status: 500 });
  }
};
