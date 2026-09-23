import { forwardToEsp32 } from "@/lib/esp32-server";
import { parseLightIntent } from "@/lib/light-intent";
import { normalizeVoiceTranscript } from "@/lib/voice-transcript";
import { classifyLightIntentWithAi, mayInterpretLightCommand, shouldConsultLightAi } from "@/lib/local-light-ai";
import { answerLightQuestion, answerStaticLightMessage } from "@/lib/light-dialogue";
import { unknownLightReply } from "@/lib/light-help";
import { database, storedContext } from '@/lib/database';
import { auditContext, recordIntent, withAudit } from '@/lib/audit';

type LightStatus = {
  brightness: number;
  on: boolean;
  blinking?: boolean;
  blinkBrightness?: number;
  blinkCount?: number;
  blinkRemaining?: number;
  blinkOnMs?: number;
  blinkOffMs?: number;
};

function usesEnglish(message: string) {
  return /[a-z]/i.test(message) && !/[฀-๿]/.test(message);
}

function statusReply(status: LightStatus, english: boolean) {
  if (status.blinking) return english ? "The light is blinking now." : "ตอนนี้ไฟกำลังกระพริบอยู่ครับ";
  if (english) return status.on ? `The light is on at ${status.brightness} percent.` : "The light is off.";
  return status.on ? `ตอนนี้ไฟเปิดอยู่ที่ ${status.brightness} เปอร์เซ็นต์ครับ` : "ตอนนี้ไฟปิดอยู่ครับ";
}

function blinkReply(brightness: number, onMs: number, offMs: number, count: number, english: boolean) {
  if (english) return count === 0
    ? `Starting continuous blinking at ${brightness} percent, ${onMs} milliseconds on and ${offMs} milliseconds off.`
    : `Blinking ${count} times at ${brightness} percent, ${onMs} milliseconds on and ${offMs} milliseconds off.`;
  return count === 0
    ? `กำลังกระพริบไฟต่อเนื่องที่ความสว่าง ${brightness} เปอร์เซ็นต์ ติด ${onMs} และดับ ${offMs} มิลลิวินาทีครับ`
    : `กำลังกระพริบไฟ ${count} ครั้ง ที่ความสว่าง ${brightness} เปอร์เซ็นต์ ติด ${onMs} และดับ ${offMs} มิลลิวินาทีครับ`;
}

function actionReply(brightness: number, english: boolean) {
  if (english) {
    if (brightness === 0) return "Turning the light off now.";
    if (brightness === 100) return "Turning the light on now.";
    return `Setting the brightness to ${brightness} percent.`;
  }
  if (brightness === 0) return "กำลังปิดไฟให้ครับ";
  if (brightness === 100) return "กำลังเปิดไฟให้ครับ";
  return `กำลังปรับความสว่างเป็น ${brightness} เปอร์เซ็นต์ให้ครับ`;
}

function unchangedReply(brightness: number, english: boolean) {
  if (english) {
    if (brightness === 0) return "The light is already off.";
    if (brightness === 100) return "The light is already on.";
    return `The light is already set to ${brightness} percent.`;
  }
  if (brightness === 0) return "ไฟปิดอยู่แล้วครับ";
  if (brightness === 100) return "ไฟเปิดอยู่แล้วครับ";
  return `ไฟตั้งไว้ที่ ${brightness} เปอร์เซ็นต์อยู่แล้วครับ`;
}

async function handle(request: Request) {
  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 200) {
    return Response.json({ error: "message must contain 1–200 characters" }, { status: 400 });
  }

  const normalizedMessage = normalizeVoiceTranscript(body.message);
  const english = usesEnglish(normalizedMessage);
  let intent = parseLightIntent(normalizedMessage);
  const staticAnswer = answerStaticLightMessage(normalizedMessage);
  if (staticAnswer !== null) {
    recordIntent({ kind: 'question' });
    return Response.json({ reply: staticAnswer });
  }
  if (intent.kind === "error" && !mayInterpretLightCommand(normalizedMessage)) {
    recordIntent(intent);
    return Response.json({ reply: unknownLightReply(english) });
  }
  const statusResponse = await forwardToEsp32("/status", "GET");
  if (!statusResponse.ok) return statusResponse;
  const currentStatus = await statusResponse.json() as LightStatus;
  const answer = answerLightQuestion(normalizedMessage, currentStatus);
  if (answer !== null) { recordIntent({ kind: 'question' }); return Response.json({ ...currentStatus, reply: answer }); }
  if (shouldConsultLightAi(intent, normalizedMessage)) {
    const history = storedContext(auditContext.getStore()!.session);
    intent = await classifyLightIntentWithAi(normalizedMessage, fetch, currentStatus, history) ?? intent;
  }
  recordIntent(intent);

  if (intent.kind === "error") {
    return Response.json({
      ...currentStatus,
      reply: unknownLightReply(english),
    });
  }
  if (intent.kind === "help") {
    return Response.json({
      ...currentStatus,
      reply: unknownLightReply(english),
    });
  }
  if (intent.kind === "status") {
    return Response.json({ ...currentStatus, reply: statusReply(currentStatus, english) });
  }
  if (intent.kind === "blink-speed") {
    if (!currentStatus.blinking) {
      return Response.json({
        ...currentStatus,
        reply: english
          ? "The light is not blinking, so I did not change anything. Tell me to blink the light first."
          : "ตอนนี้ไฟไม่ได้กำลังกระพริบ จึงยังไม่ได้เปลี่ยนอะไรครับ สั่งให้กระพริบไฟก่อนนะครับ",
      });
    }
    const factor = intent.speed === "slow" ? 2 : 0.5;
    const onMs = intent.speed === "normal" ? 500 : Math.max(50, Math.min(5000, Math.round((currentStatus.blinkOnMs ?? 500) * factor)));
    const offMs = intent.speed === "normal" ? 500 : Math.max(50, Math.min(5000, Math.round((currentStatus.blinkOffMs ?? 500) * factor)));
    const brightness = currentStatus.blinkBrightness ?? 100;
    const count = currentStatus.blinkCount === 0
      ? 0
      : Math.max(1, currentStatus.blinkRemaining ?? currentStatus.blinkCount ?? 1);
    const response = await forwardToEsp32(`/blink?brightness=${brightness}&onMs=${onMs}&offMs=${offMs}&count=${count}`, "POST");
    if (!response.ok) return response;
    const lightStatus = await response.json() as LightStatus;
    const speedText = intent.speed === "slow" ? "ช้าลง" : intent.speed === "fast" ? "เร็วขึ้น" : "ความเร็วปกติ";
    const englishSpeed = intent.speed === "slow" ? "slower" : intent.speed === "fast" ? "faster" : "to normal speed";
    return Response.json({
      ...lightStatus,
      reply: english
        ? `Changing the blinking ${englishSpeed}.`
        : `กำลังปรับไฟให้กระพริบ${speedText}ครับ`,
    });
  }
  if (intent.kind === "stop-blink") {
    const response = await forwardToEsp32("/blink/stop", "POST");
    if (!response.ok) return response;
    const lightStatus = await response.json() as LightStatus;
    return Response.json({ ...lightStatus, reply: english ? "Stopping the blinking now." : "กำลังหยุดไฟกระพริบให้ครับ" });
  }
  if (intent.kind === "blink") {
    const { brightness, onMs, offMs, count } = intent;
    const response = await forwardToEsp32(`/blink?brightness=${brightness}&onMs=${onMs}&offMs=${offMs}&count=${count}`, "POST");
    if (!response.ok) return response;
    const lightStatus = await response.json() as LightStatus;
    return Response.json({ ...lightStatus, reply: blinkReply(brightness, onMs, offMs, count, english) });
  }

  const asksToTurnOn = /เปิด|turn.*on|switch.*on|^on$/i.test(normalizedMessage)
    && !/[0-9๐-๙%]|สว่าง|เต็ม|สุด|percent|bright/i.test(normalizedMessage);
  if (intent.kind === "set" && intent.value === 100 && asksToTurnOn && currentStatus.on && !currentStatus.blinking) {
    return Response.json({ ...currentStatus, reply: english ? "The light is already on." : "ไฟเปิดอยู่แล้วครับ" });
  }
  const brightness = intent.kind === "adjust"
    ? Math.max(0, Math.min(100, currentStatus.brightness + intent.value))
    : intent.value;
  if (!currentStatus.blinking && currentStatus.brightness === brightness) {
    return Response.json({ ...currentStatus, reply: unchangedReply(brightness, english) });
  }
  const lightResponse = await forwardToEsp32(`/light?brightness=${brightness}`, "POST");
  if (!lightResponse.ok) return lightResponse;
  const lightStatus = await lightResponse.json() as LightStatus;
  return Response.json({ ...lightStatus, reply: actionReply(lightStatus.brightness, english) });
}

export async function POST(request: Request) {
  return withAudit(request, 'chat', async session => {
    let body;
    try { body = await request.clone().json(); } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
    if (typeof body?.message !== 'string' || !body.message.trim() || body.message.length > 200) return Response.json({ error: 'message must contain 1–200 characters' }, { status: 400 });
    const db = database();
    const id = Number(db.prepare('INSERT INTO chat_turns(session_id,input) VALUES (?,?)').run(session,body.message).lastInsertRowid);
    auditContext.getStore()!.turnId = id;
    const started = Date.now();
    try {
      const response = await handle(request);
      const result = await response.clone().json();
      db.prepare('UPDATE chat_turns SET reply=?,outcome=?,duration_ms=? WHERE id=?').run(result.reply ?? result.error ?? 'Request failed',response.ok ? 'answered' : 'error',Date.now()-started,id);
      return response;
    } catch (error) {
      db.prepare('UPDATE chat_turns SET reply=?,outcome=?,duration_ms=? WHERE id=?').run('ส่งคำสั่งไม่สำเร็จ','error',Date.now()-started,id);
      throw error;
    }
  });
}
