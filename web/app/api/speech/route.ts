import { hasLocalTts, synthesizeLocal } from '@/lib/local-tts';

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 200) {
    return Response.json({ error: "text must contain 1-200 characters" }, { status: 400 });
  }

  try {
    // On a development machine the web server can run the installed voice
    // directly. A configured TTS_BASE_URL preserves the Pi's separate service.
    if (!process.env.TTS_BASE_URL && hasLocalTts()) {
      const audio = await synthesizeLocal(body.text.trim());
      const wav = new ArrayBuffer(audio.byteLength);
      new Uint8Array(wav).set(audio);
      return new Response(wav, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
    }
    const baseUrl = process.env.TTS_BASE_URL || "http://127.0.0.1:8765";
    const response = await fetch(new URL("/speech", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body.text.trim() }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`TTS returned HTTP ${response.status}`);
    return new Response(await response.arrayBuffer(), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Local Thai TTS failed:", error);
    return Response.json({ error: "สร้างเสียงไทยไม่สำเร็จ" }, { status: 503 });
  }
}
