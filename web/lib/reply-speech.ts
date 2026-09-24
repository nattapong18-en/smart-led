// The full guidance is meant to be read in chat and exceeds the TTS endpoint's
// 200-character limit. Do not attempt playback or surface a misleading error.
export function shouldSpeakReply(reply: string): boolean {
  return reply.length <= 200 && !/^(?:ไม่รู้จักคำสั่งนี้ครับ|I don't know that command\.)/.test(reply);
}

// Keep precise timings and counts in chat, but use a short cached Thai line
// for speech. Otherwise every blink setting becomes a new TTS cache miss on
// Render Free and falls back to the device's often-poor Thai browser voice.
export function speechTextForReply(reply: string): string | null {
  if (!shouldSpeakReply(reply)) return null;
  if (/^กำลังกระพริบไฟ(?:ต่อเนื่อง| [0-9]+ ครั้ง)/.test(reply)) return "ตอนนี้ไฟกำลังกระพริบอยู่ครับ";
  if (reply.startsWith("ตอนนี้ไฟกระพริบที่ ")) return "ตอนนี้ไฟกำลังกระพริบอยู่ครับ";
  const steady = /^ตอนนี้ไฟเปิดที่ ([0-9]+) เปอร์เซ็นต์ครับ เป็นไฟติดค้าง/.exec(reply);
  if (steady) return `ตอนนี้ไฟเปิดอยู่ที่ ${steady[1]} เปอร์เซ็นต์ครับ`;
  if (reply.startsWith("ตอนนี้ไฟปิดอยู่ครับ อยากให้เปิด")) return "ตอนนี้ไฟปิดอยู่ครับ";
  if (reply.startsWith("บอร์ดรายงานความสว่าง ")) return "ผมยังมองไฟจริงไม่ได้ครับ ลองเช็ก LED บนบอร์ดที่ GPIO2 ด้วยครับ";
  return reply;
}
