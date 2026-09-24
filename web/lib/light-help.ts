export const LIGHT_EXAMPLES_TH = [
  "เปิดไฟ / ปิดไฟ",
  "ตั้งความสว่าง 50% / สว่างขึ้นอีกนิด",
  "กระพริบไฟช้า / กระพริบไฟเร็ว 5 ครั้ง",
  "เอาช้าลง / หยุดกระพริบไฟ",
  "ตอนนี้ไฟเปิดอยู่ไหม / ไฟสว่างกี่เปอร์เซ็นต์",
];

export const LIGHT_EXAMPLES_EN = [
  "turn on the light / turn off the light",
  "set brightness to 50 percent / brighter",
  "blink slowly / blink fast 5 times",
  "slower / stop blinking",
  "is the light on? / how bright is the light?",
];

export const LIGHT_INTRO_TH = `สวัสดีครับ ผม Lumen Home ผู้ช่วยควบคุมไฟดวงนี้ สั่งงานได้ทั้งพิมพ์ข้อความและพูด: กดปุ่มไมโครโฟนข้างช่องแชต แล้วพูดคำสั่งได้เลยครับ\n\nผมช่วยเปิดปิด ปรับความสว่าง กระพริบไฟ และตอบคำถามเรื่องสถานะไฟได้ ลองสั่ง เช่น\n${LIGHT_EXAMPLES_TH.map((example, index) => `${index + 1}. ${example}`).join("\n")}\n\nผมควบคุมได้เฉพาะไฟดวงนี้ ยังเปลี่ยนสีหรือเลือกห้องไม่ได้ครับ`;

export function unknownLightReply(english: boolean): string {
  const examples = english ? LIGHT_EXAMPLES_EN : LIGHT_EXAMPLES_TH;
  const heading = english
    ? "I don't know that command. I can only help with this light. Try asking or saying:"
    : "ไม่รู้จักคำสั่งนี้ครับ ผมช่วยได้เฉพาะเรื่องไฟดวงนี้ ลองถามหรือสั่งแบบนี้ได้เลย:";
  const voiceHint = english
    ? "You can also tap the microphone next to the chat box and speak your command."
    : "หรือกดปุ่มไมโครโฟนข้างช่องแชต แล้วพูดสั่งงานได้ครับ";
  return `${heading}\n${examples.map((example, index) => `${index + 1}. ${example}`).join("\n")}\n${voiceHint}`;
}
