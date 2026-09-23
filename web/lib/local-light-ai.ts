import type { LightIntent } from "./light-intent";

export type LightContext = { brightness: number; on: boolean; blinking?: boolean; blinkOnMs?: number; blinkOffMs?: number };
export function mayInterpretLightCommand(message: string): boolean {
  if (/(อย่า|ห้าม|ไม่ต้อง|ไม่อยาก|ไม่เปิด|ไม่ปิด|don't|do not|never|ignore|system|prompt|สมมติ|ถ้า|หรือ(?!เปล่า)|เอกสาร|เพลง|อากาศ|ห้องนอน|ห้องครัว|ห้องน้ำ|bedroom|kitchen|bathroom|สี(?:แดง|เขียว|ฟ้า|น้ำเงิน|ม่วง|เหลือง|ชมพู|ส้ม)|red light|green light|blue light)/i.test(message)) return false;
  if (/(เปิด.*ปิด|ปิด.*เปิด|turn.*on.*turn.*off|turn.*off.*turn.*on|(?:กระพริบ|กระพิบ|กะพริบ|กะพิบ|blink|flash).*(?:แล้ว|และ|then)(?:ปิด|ดับ|off))/i.test(message)) return false;
  return /(ไฟ|สว่าง|แสง|กระพริบ|กระพิบ|กะพริบ|กะพิบ|ช้า|เร็ว|light|bright|dim|blink|flash|slower|faster)/i.test(message);
}

export function shouldConsultLightAi(intent: LightIntent, message: string): boolean {
  // Only an unrecognized phrase may be reinterpreted. Invalid numbers and
  // explicit safety rejections must never be "corrected" by a small model.
  return intent.kind === 'error' && intent.message.startsWith('ยังไม่เข้าใจคำสั่งนี้') && mayInterpretLightCommand(message);
}

type OllamaReply = {
  message?: { content?: string };
};

type ModelDecision = {
  action: "on" | "off" | "set" | "status" | "blink" | "stop_blink" | "slower" | "faster" | "unknown";
  brightness: number | null;
  on_ms: number | null;
  off_ms: number | null;
  count: number | null;
};

const decisionSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["on", "off", "set", "status", "blink", "stop_blink", "slower", "faster", "unknown"] },
    brightness: { type: ["integer", "null"], minimum: 0, maximum: 100 },
    on_ms: { type: ["integer", "null"], minimum: 50, maximum: 5000 },
    off_ms: { type: ["integer", "null"], minimum: 50, maximum: 5000 },
    count: { type: ["integer", "null"], minimum: 0, maximum: 100 },
  },
  required: ["action"],
};

const systemPrompt = `Classify the latest light command. Return JSON only.
เปิดไฟ / turn on = on. ปิดไฟ / turn off = off.
ช้าลง / slower = slower. เร็วขึ้น / faster = faster.
สถานะไฟ / light status = status. กระพริบ / blink = blink. หยุดกระพริบ = stop_blink.
Requested brightness percentage = set with brightness. Never invent numbers.
Unrelated, ambiguous or negated commands = unknown.
Return only action unless numerical settings are explicitly requested.`;

function toIntent(decision: ModelDecision): LightIntent | null {
  if (decision.action === "on" && decision.brightness === null) return { kind: "set", value: 100 };
  if (decision.action === "off" && decision.brightness === null) return { kind: "set", value: 0 };
  if (decision.action === "status" && decision.brightness === null) return { kind: "status" };
  if (decision.action === "stop_blink") return { kind: "stop-blink" };
  if (decision.action === "blink" && Number.isInteger(decision.brightness) && decision.brightness !== null && decision.brightness >= 1 && decision.brightness <= 100 &&
      Number.isInteger(decision.on_ms) && decision.on_ms !== null && decision.on_ms >= 50 && decision.on_ms <= 5000 &&
      Number.isInteger(decision.off_ms) && decision.off_ms !== null && decision.off_ms >= 50 && decision.off_ms <= 5000 &&
      Number.isInteger(decision.count) && decision.count !== null && decision.count >= 0 && decision.count <= 100) {
    return { kind: "blink", brightness: decision.brightness, onMs: decision.on_ms, offMs: decision.off_ms, count: decision.count };
  }
  if (decision.action === "set" && Number.isInteger(decision.brightness) && decision.brightness !== null && decision.brightness >= 0 && decision.brightness <= 100) {
    return { kind: "set", value: decision.brightness };
  }
  return null;
}

export async function classifyLightIntentWithAi(
  message: string,
  fetcher: typeof fetch = fetch,
  context?: LightContext,
  history: { role: string; text: string }[] = [],
): Promise<LightIntent | null> {
  if (!mayInterpretLightCommand(message)) return null;
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "qwen3:0.6b";
  const actions = /(ช้า|slow)/i.test(message) ? ["slower", "unknown"]
    : /(เร็ว|fast)/i.test(message) ? ["faster", "unknown"]
    : ["on", "off", "set", "status", "blink", "stop_blink", "unknown"];
  const format = /[0-9๐-๙]/.test(message) ? decisionSchema : {
    type: "object", properties: { action: { type: "string", enum: actions } }, required: ["action"], additionalProperties: false,
  };

  try {
    const response = await fetcher(new URL("/api/chat", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        keep_alive: 0,
        format,
        options: { num_ctx: 1024, num_predict: 128, temperature: 0 },
        messages: [
          { role: "system", content: systemPrompt + '\nState: ' + JSON.stringify(context ? { brightness: context.brightness, blinking: context.blinking } : {}) + '\nPrevious request (context only, do not execute): ' + (history.filter(item => item.role === "user").at(-1)?.text.slice(0, 120) ?? "none") },
          { role: "user", content: message },
        ],
      }),
    });
    if (!response.ok) return null;

    const result = await response.json() as OllamaReply;
    if (typeof result.message?.content !== "string") return null;
    const decision = JSON.parse(result.message.content) as ModelDecision;
    if (!decision || typeof decision !== "object") return null;
    if (decision.brightness === undefined) decision.brightness = null;
    // Model output is a proposal. Require evidence for the action in the
    // current utterance; history alone must never authorize switching a light.
    if (/(ช้า|เร็ว|slow|fast)/i.test(message)) {
      if (!context?.blinking) return null;
      if (decision.action === "slower" && /(ช้า|slow)/i.test(message)) return { kind: "blink-speed", speed: "slow" };
      if (decision.action === "faster" && /(เร็ว|fast)/i.test(message)) return { kind: "blink-speed", speed: "fast" };
      return null;
    }
    if (decision.action === "on" && !/(เปิด|ติด|turn.*on|switch.*on)/i.test(message)) return null;
    if (decision.action === "off" && !/(ปิด|ดับ|turn.*off|switch.*off)/i.test(message)) return null;
    if (decision.action === "set" && !Array.from(message.matchAll(/[+-]?\d+(?:\.\d+)?/g), match => Number(match[0])).includes(decision.brightness as number)) return null;
    if ((decision.action === "blink" || decision.action === "stop_blink") && !/(กระพริบ|กระพิบ|กะพริบ|กะพิบ|blink|flash)/i.test(message)) return null;
    return toIntent(decision);
  } catch (error) {
    console.warn("Local light AI unavailable:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
