import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { status: 204 });

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { content } = await req.json();
    if (!content || typeof content !== "string") {
      return new Response(JSON.stringify({ error: "Missing content" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENROUTER_API_KEY secret" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prompt =
      `Generate a short, concise title (max 6 words) for this note.\n` +
      `Return ONLY the title text, no quotes.\n\nNOTE:\n${content}`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Smart Notes Hackathon",
      },
      body: JSON.stringify({
        // Nimm ein Free-Model, damit du nicht an Bezahlung scheiterst:
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "OpenRouter error", status: resp.status, raw }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = JSON.parse(raw);
    const title = data?.choices?.[0]?.message?.content?.trim();

    return new Response(JSON.stringify({ title: title || "Untitled" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Function exception", message: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});