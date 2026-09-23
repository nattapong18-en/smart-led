import { unknownLightReply } from "./light-help.ts";

type State = { brightness: number; on: boolean; blinking?: boolean; blinkBrightness?: number; blinkOnMs?: number; blinkOffMs?: number; blinkCount?: number; blinkRemaining?: number };

export function answerStaticLightMessage(message: string): string | null {
  const text = message.toLowerCase().trim();
  const en = /[a-z]/i.test(text) && !/[฀-๿]/.test(text);
  if (/^(สวัสดี(?:ครับ|ค่ะ)?|หวัดดี|hello|hi)[!?. ]*$/.test(text)) return en
    ? "Hi! I can help with your light. Want to check its status or change the brightness?"
    : "สวัสดีครับ อยากเช็กสถานะไฟ หรือปรับแสงแบบไหน บอกได้เลยครับ";
  if (/^(ขอบคุณ(?:ครับ|ค่ะ)?|thanks|thank you)[!?. ]*$/.test(text)) return en ? "You're welcome! Let me know if you'd like to adjust the light." : "ยินดีครับ อยากปรับไฟอีกก็บอกได้เลย";
  if (/(ทำอะไรได้บ้าง|ช่วยอะไรได้|ใช้งานยังไง|ใช้ยังไง|สั่งยังไง|what can you do|how do i use)/.test(text) || /^help(?: me)?[!?. ]*$/.test(text)) return unknownLightReply(en);
  return null;
}

// Read-only conversation is handled before the action parser. Mentioning
// "blink" inside a question must never start blinking.
export function answerLightQuestion(message: string, state: State): string | null {
  const text = message.toLowerCase().trim();
  const en = /[a-z]/i.test(text) && !/[฀-๿]/.test(text);
  const staticAnswer = answerStaticLightMessage(message);
  if (staticAnswer !== null) return staticAnswer;
  if (/^ไฟ(?:เปิด|ปิด)อยู่แล้ว(?:ครับ|ค่ะ)?$/.test(text) || /^the light is already (?:on|off)[.!? ]*$/.test(text)) {
    if (state.blinking) return en ? "The light is blinking now." : "ตอนนี้ไฟกำลังกระพริบอยู่ครับ";
    return en ? (state.on ? `The light is on at ${state.brightness} percent.` : "The light is off.")
      : state.on ? `ตอนนี้ไฟเปิดอยู่ที่ ${state.brightness} เปอร์เซ็นต์ครับ` : "ตอนนี้ไฟปิดอยู่ครับ";
  }
  const question = /(เท่าไหร่|เท่าไร|กี่เปอร์เซ็นต์|แค่ไหน|ยังไง|อย่างไร|อะไร|หรือยัง|อยู่ไหม|อยู่มั้ย|ไหม|มั้ย|หรือเปล่า|ทำไม|\?|\b(how|what|why|is|are|can)\b)/.test(text);
  const topic = /(ไฟ|แสง|สว่าง|กระพริบ|กระพิบ|light|bright|blink|flash)/.test(text);
  // Requests such as "เปิดไฟให้หน่อยได้ไหม" are still action requests.
  if (!question || !topic || /^(?:ช่วย|please)?\s*(?:เปิดไฟ|ปิดไฟ|กระพริบไฟ|กระพิบไฟ|กะพริบไฟ|กะพิบไฟ|ตั้งความสว่าง|ปรับความสว่าง|turn on|turn off|blink|flash|set brightness).*?(?:ให้|please|ได้ไหม|ได้มั้ย|ได้หรือเปล่า)/.test(text)) return null;
  if (/(คืออะไร|หมายถึง|what is|what does)/.test(text)) return en
    ? (/(blink|flash)/.test(text) ? "Blinking alternates the light on and off. Set the on/off durations and repeat count; zero repeats means continuous blinking." : "Brightness is the light level from 0 to 100 percent. Zero turns it off; 100 is full brightness.")
    : /(กระพริบ|กระพิบ)/.test(text) ? "ไฟกระพริบคือสลับติดกับดับครับ ตั้งเวลาติด เวลาดับ และจำนวนครั้งได้ ถ้าตั้งจำนวนเป็นศูนย์จะกระพริบต่อเนื่อง"
    : "ความสว่างปรับได้ตั้งแต่ศูนย์ถึงร้อยเปอร์เซ็นต์ครับ ศูนย์คือปิดไฟ ส่วนร้อยคือสว่างเต็มที่";
  if (/(ทำไม|why|ไม่ติด|ไม่สว่าง)/.test(text)) return en
    ? `The board reports ${state.brightness} percent. I cannot see the physical LED. If it stays dark, check that the board's LED is connected to GPIO2.`
    : `บอร์ดรายงานความสว่าง ${state.brightness} เปอร์เซ็นต์ครับ ผมยังมองไฟจริงไม่ได้ ถ้าไฟไม่ติด ลองเช็กว่า LED บนบอร์ดรุ่นนี้อยู่ที่ GPIO2 หรือเปล่าครับ`;
  if (/(ได้ไหม|ได้มั้ย|ทำได้|can you|how to|อย่างไร|ยังไง)/.test(text)) return en
    ? "Yes, I can help with this light. Try 'set brightness to 50 percent' or 'blink fast 5 times'. I haven't changed the light."
    : "ได้ครับ ลองบอกว่า ปรับไฟ 50 เปอร์เซ็นต์ หรือ กระพริบไฟเร็ว 5 ครั้ง ก็ได้ ตอนนี้ผมยังไม่ได้เปลี่ยนไฟนะครับ";
  if (state.blinking) {
    const brightness = state.blinkBrightness ?? 100;
    const on = (state.blinkOnMs ?? 500) / 1000;
    const off = (state.blinkOffMs ?? 500) / 1000;
    return en ? `The light is blinking at ${brightness} percent: ${on} seconds on, ${off} seconds off.`
      : `ตอนนี้ไฟกระพริบที่ ${brightness} เปอร์เซ็นต์ครับ ติด ${on} วินาที ดับ ${off} วินาที อยากปรับจังหวะก็บอกได้เลย`;
  }
  return en ? (state.on ? `The light is on at ${state.brightness} percent. It is not blinking.` : "The light is off. Would you like to turn it on?")
    : state.on ? `ตอนนี้ไฟเปิดที่ ${state.brightness} เปอร์เซ็นต์ครับ เป็นไฟติดค้าง ไม่ได้กระพริบ` : "ตอนนี้ไฟปิดอยู่ครับ อยากให้เปิดก็บอกได้เลย";
}
