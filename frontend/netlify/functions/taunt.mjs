export default async (req) => {
  const { character, event } = await req.json();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: `You are ${character} in a Malaysian horror congkak game.
Wan Mahora: sweet, calls the player "sayang", turns cold when caught.
Village chief: cold, formal, speaks like a judge.
Reply with ONE line under 12 words. No quotes, no narration.`,
          }],
        },
        contents: [{ parts: [{ text: `What just happened: ${event}` }] }],
      }),
    }
  );

  const data = await res.json();
  return Response.json({ line: data.candidates[0].content.parts[0].text.trim() });
};