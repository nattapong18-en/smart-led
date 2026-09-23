export type LightIntent =
  | { kind: "set"; value: number }
  | { kind: "adjust"; value: number }
  | { kind: "status" }
  | { kind: "blink"; brightness: number; onMs: number; offMs: number; count: number }
  | { kind: "blink-speed"; speed: "fast" | "normal" | "slow" }
  | { kind: "stop-blink" }
  | { kind: "help" }
  | { kind: "error"; message: string };

export const LIGHT_HELP = "ลอง: เปิดไฟ, ปิดไฟ, กระพริบไฟเร็ว 5 ครั้ง, กระพริบต่อเนื่อง, หยุดกระพริบ หรือ blink fast 5 times";

// Speech recognition and casual Thai commonly drop the ร in "กระพริบ".
// Keep every blink spelling on the deterministic path so a small LLM can
// never reinterpret a blink request as "ปิดไฟ".
const THAI_BLINK = "(?:กระพริบ|กะพริบ|กระพิบ|กะพิบ)";

function normalize(input: string) {
  let text = input.toLowerCase()
    .replace(/[๐-๙]/g, (digit) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)))
    .replace(/[!?？！。，,'’.]/g, "")
    .replace(/\s+/g, "");

  for (let i = 0; i < 6; i++) {
    text = text
      .replace(/^(ช่วย|กรุณา|รบกวน|ขอ|อยากให้|ต้องการ|อยากได้|สั่งให้|สั้งให้|บอกให้|สั่ง|สั้ง|บอก|ทำการ|เอา|please|helpme|couldyou|canyou|wouldyou|iwantyouto)/, "")
      .replace(/(ให้หน่อยดิ|หน่อยดิ|ทีดิ|ให้หน่อย|หน่อย|เดี๋ยวนี้|ตอนนี้|ครับผม|ครับ|ค่ะ|คะ|นะครับ|นะคะ|ให้ที|ได้ไหม|ได้มั้ย|please|ที|สิ|เลย|ดิ|นะ|ด้วย)$/, "");
  }
  return text;
}

function replaceThaiNumbers(text: string) {
  const units = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const numbers: [string, number][] = [["หนึ่งร้อย", 100], ["ร้อย", 100]];
  for (let n = 0; n < 100; n++) {
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    const word = tens === 0
      ? units[unit]
      : (tens === 1 ? "" : tens === 2 ? "ยี่" : units[tens]) + "สิบ" + (unit === 0 ? "" : unit === 1 ? "เอ็ด" : units[unit]);
    numbers.push([word, n]);
  }
  const pattern = new RegExp(numbers.sort((a, b) => b[0].length - a[0].length).map(([word]) => word).join("|"), "g");
  const values = new Map(numbers);
  return text.replace(pattern, (word) => String(values.get(word)));
}

export function parseLightIntent(input: string): LightIntent {
  let text = normalize(input);
  const fail = (message = "ยังไม่เข้าใจคำสั่งนี้ " + LIGHT_HELP): LightIntent => ({ kind: "error", message });

  if (/(อย่า|ห้าม|ไม่ต้อง|ไม่อยาก|ไม่เปิด|ไม่ปิด|dont|donot|never)/.test(text)) {
    return fail("ไม่ได้เปลี่ยนไฟ เพราะข้อความเป็นคำสั่งห้ามหรือปฏิเสธ");
  }
  if (/(สมมติ|ถ้า|คำว่า|แปลว่า|คืออะไร|เล่าเรื่อง|เพลง|เอกสาร|ignore|system|prompt)/.test(text)) return fail("ไม่ได้เปลี่ยนไฟ เพราะข้อความไม่ได้เป็นคำสั่งไฟโดยตรง");
  if (/(ห้องนอน|ห้องครัว|ห้องน้ำ|bedroom|kitchen|bathroom)/.test(text)) return fail("ไม่ได้เปลี่ยนไฟ เพราะระบบควบคุมไฟได้เพียงดวงเดียว");
  if (/(สี(?:แดง|เขียว|ฟ้า|น้ำเงิน|ม่วง|เหลือง|ชมพู|ส้ม)|redlight|greenlight|bluelight|purplelight|yellowlight|pinklight|orangelight)/.test(text)) return fail("ไม่ได้เปลี่ยนไฟ เพราะหลอดนี้ปรับสีไม่ได้");
  if (/(เปิด.*ปิด|ปิด.*เปิด|turnon.*turnoff|turnoff.*turnon|(?:กระพริบ|กระพิบ|กะพริบ|กะพิบ|blink|flash).*(?:แล้ว|และ|then)(?:ปิด|ดับ|off))/.test(text)) return fail("ไม่ได้เปลี่ยนไฟ เพราะมีหลายคำสั่งในข้อความเดียว");
  if (/^(help|commands|whatcanyoudo|ช่วยเหลือ|คำสั่ง|ใช้ยังไง|ทำอะไรได้บ้าง)$/.test(text)) return { kind: "help" };
  if (/^(status|lightstatus|whatsthelightstatus|isthelighton|isthelightoff|howbrightisthelight|สถานะ|สถานะไฟ|เช็คไฟ|เช็กไฟ|ดูสถานะไฟ|ตอนนี้ไฟเป็นยังไง|ไฟเปิดอยู่ไหม|ไฟเปิดไหม|ไฟปิดไหม|ความสว่างเท่าไหร่|ไฟสว่างเท่าไหร่)$/.test(text)) return { kind: "status" };

  // Follow-up commands while blinking are contextual. Parse them here rather
  // than asking the small model to guess an unrelated on/off action.
  if (/^(?:เอา|ให้)?(?:ช้าๆ?|ช้าลง|ช้ากว่านี้|slower|moreslowly)$/.test(text)) return { kind: "blink-speed", speed: "slow" };
  if (/^(?:เอา|ให้)?(?:เร็วๆ?|เร็วขึ้น|เร็วกว่านี้|faster|morequickly)$/.test(text)) return { kind: "blink-speed", speed: "fast" };
  if (/^(?:เอา|ให้)?(?:ปกติ|ความเร็วปกติ|normalspeed)$/.test(text)) return { kind: "blink-speed", speed: "normal" };

  text = replaceThaiNumbers(text);
  if (new RegExp(`^(หยุด|เลิก|ปิด)(?:การ)?(?:ไฟ)?${THAI_BLINK}(?:ไฟ)?(?:แล้ว)?$`).test(text) || /^(stop|cancel)(?:the)?(?:blinking|flashing|blink|flash)(?:light|lights)?$/.test(text)) {
    return { kind: "stop-blink" };
  }
  const blinkSpeed = text.match(new RegExp(`^(?:ทำให้)?(?:ไฟ)?${THAI_BLINK}(?:ไฟ)?(?:ให้)?(ช้าลง|ช้ากว่านี้|เร็วขึ้น|เร็วกว่านี้|ปกติ)$`));
  if (blinkSpeed) return { kind: "blink-speed", speed: /ช้า/.test(blinkSpeed[1]) ? "slow" : /เร็ว/.test(blinkSpeed[1]) ? "fast" : "normal" };
  if (/^(?:make)?(?:the)?(?:light)?(?:blink|flash)(?:ing)?(slower|faster)$/.test(text)) return { kind: "blink-speed", speed: /slower$/.test(text) ? "slow" : "fast" };
  if (new RegExp(`${THAI_BLINK}|blink|flash`).test(text)) {
    const countMatch = text.match(/(\d+)(?:ครั้ง|รอบ|ที|times?|x)/);
    const englishCount = text.match(/(one|two|three|four|five|six|seven|eight|nine|ten)(?:times?|x)/);
    const englishNumbers: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    if (!countMatch && !englishCount && /(?:ครั้ง|รอบ|times?|\d+x)/.test(text)) return fail("ไม่ได้เปลี่ยนไฟ เพราะจำนวนครั้งไม่ชัดเจน");
    const count = countMatch ? Number(countMatch[1]) : englishCount ? englishNumbers[englishCount[1]] : 0;
    const brightnessMatch = text.match(/(?:ความสว่าง|สว่าง|brightness)(?:ที่|เป็น|to|at)?(\d+)(?:%|เปอร์เซ็นต์|percent)?/);
    const percentMatch = text.match(/(?:ที่|at)?(\d+)(?:%|เปอร์เซ็นต์|percent)/);
    const brightness = brightnessMatch ? Number(brightnessMatch[1]) : percentMatch ? Number(percentMatch[1]) : 100;
    const intervalMs = text.match(/(?:ทุก|จังหวะ|every)?(\d+)(?:ms|มิลลิวินาที)/);
    const intervalSeconds = text.match(/(?:ทุก|จังหวะ|every)?(\d+)(?:วินาที|seconds?|secs?)/);
    const explicitOn = text.match(/(?:ติด|เปิด|on)(\d+)(?:ms|มิลลิวินาที)/);
    const explicitOff = text.match(/(?:ดับ|ปิด|off)(\d+)(?:ms|มิลลิวินาที)/);
    let onMs = /(?:เร็ว|fast|quick)/.test(text) ? 200 : /(?:ช้า|slow)/.test(text) ? 1000 : 500;
    let offMs = onMs;
    if (intervalMs) onMs = offMs = Number(intervalMs[1]);
    if (intervalSeconds) onMs = offMs = Number(intervalSeconds[1]) * 1000;
    if (explicitOn) onMs = Number(explicitOn[1]);
    if (explicitOff) offMs = Number(explicitOff[1]);
    if (!Number.isInteger(count) || count < 0 || count > 100 ||
        !Number.isInteger(brightness) || brightness < 1 || brightness > 100 ||
        onMs < 50 || onMs > 5000 || offMs < 50 || offMs > 5000) {
      return fail("ค่ากระพริบไม่ถูกต้อง: ความสว่าง 1–100%, เวลา 50–5000 ms, จำนวน 0–100 ครั้ง");
    }
    return { kind: "blink", brightness, onMs, offMs, count };
  }
  if (/^(เปิด|เปิดไฟ|เปิดหลอด(?:ไฟ)?(?:ตรงนี้)?|ไฟติด|on|lighton|lightson|switchon|switchonthelight|turnon|turnonthelight|turnonthelights|turnthelighton|turnthelampon|turnonthelamp|สว่างสุด|สว่างที่สุด|สว่างเต็มที่|เต็ม|เต็มที่|ไฟเต็ม|ไฟสว่างสุด)$/.test(text)) return { kind: "set", value: 100 };
  if (/^(ปิด|ปิดไฟ|ปิดหลอด(?:ไฟ)?(?:ตรงนี้)?|ดับไฟ|ไฟดับ|off|lightoff|lightsoff|switchoff|switchoffthelight|turnoff|turnoffthelight|turnoffthelights|turnthelightoff|turnthelampoff|turnoffthelamp)$/.test(text)) return { kind: "set", value: 0 };
  if (/^(?:ไฟ|เปิดไฟ|ปรับไฟ|ความสว่าง)?(?:ครึ่ง|ครึ่ง1|ครึ่งเดียว|ปานกลาง|half|halfway|medium)$/.test(text)) return { kind: "set", value: 50 };
  if (/^(ไฟสลัว|สลัว|ไฟสลัวๆ|แสงน้อย|dim|dimlight|lowlight)$/.test(text)) return { kind: "set", value: 25 };

  const englishRelative = text.match(/^(brighter|brighten|increasebrightness|increasethebrightness|turnitup|dimmer|dimthelight|decreasebrightness|decreasethebrightness|lowerbrightness|turnitdown)(?:by)?([+-]?\d+(?:\.\d+)?)?(?:%|percent)?$/);
  if (englishRelative) {
    const amount = englishRelative[2] === undefined ? 10 : Number(englishRelative[2]);
    if (!Number.isInteger(amount) || amount < 0 || amount > 100) return fail("Brightness must be a whole number from 0 to 100 percent.");
    return { kind: "adjust", value: /^(dimmer|dim|decrease|lower|turnitdown)/.test(englishRelative[1]) ? -amount : amount };
  }
  if (/^dim(?:the)?lights?(?:abit|alittle)?$/.test(text)) return { kind: "adjust", value: -10 };

  if (/^(?:หรี่ไฟ|ปรับไฟ|ตั้งไฟ|ปรับความสว่าง|ตั้งความสว่าง)(?:ให้)?เหลือ(?=\d)/.test(text)) {
    text = text.replace(/^(?:หรี่ไฟ|ปรับไฟ|ตั้งไฟ|ปรับความสว่าง|ตั้งความสว่าง)(?:ให้)?เหลือ/, "ความสว่าง");
  }
  if (/^หรี่ไฟ[0-9]/.test(text)) text = text.replace(/^หรี่ไฟ/, "ความสว่าง");
  if (/^ไฟ(?:สว่างขึ้น|หรี่ลง|มืดลง)/.test(text)) text = text.replace(/^ไฟ/, "");
  if (/^(สว่างขึ้นหน่อย|เพิ่มความสว่างหน่อย)$/.test(text)) text = "สว่างขึ้น";
  const relative = text.match(/^(เพิ่มความสว่าง|เพิ่มแสง|เพิ่มไฟ|สว่างขึ้น|สว่างขึ้นอีก|ลดความสว่าง|ลดแสง|ลดไฟ|หรี่ไฟ|หรี่ลง|มืดลง)(?:ลง|ขึ้น)?(?:อีก)?([+-]?\d+(?:\.\d+)?)?(?:%|เปอร์เซ็นต์)?(?:อีกนิด|นิดหน่อย|นิด)?$/);
  if (relative) {
    const amount = relative[2] === undefined ? 10 : Number(relative[2]);
    if (!Number.isInteger(amount) || amount < 0 || amount > 100) return fail("กรุณาระบุจำนวนเต็มตั้งแต่ 0 ถึง 100 เปอร์เซ็นต์");
    return { kind: "adjust", value: /^(ลด|หรี่|มืด)/.test(relative[1]) ? -amount : amount };
  }

  const absolute = text.match(/^(?:(?:ปรับความสว่าง|ตั้งความสว่าง|ความสว่าง|ปรับไฟ|ตั้งไฟ|เปิดไฟ|หรี่ไฟ|ไฟสว่าง|สว่าง|brightness|setbrightness|setthebrightness|setlight|setthelight)(?:เป็น|ที่|เท่ากับ|to|at)?)?([+-]?\d+(?:\.\d+)?)(?:%|เปอร์เซ็นต์|percent)?$/);
  if (absolute) {
    const value = Number(absolute[1]);
    return Number.isInteger(value) && value >= 0 && value <= 100
      ? { kind: "set", value }
      : fail("ความสว่างต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 100 เปอร์เซ็นต์");
  }
  return fail();
}
