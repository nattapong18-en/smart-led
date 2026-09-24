import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { shouldSpeakReply, speechTextForReply } from "./reply-speech.ts";
import { unknownLightReply } from "./light-help.ts";

test("guidance is shown in chat without sending oversized text to TTS", () => {
  assert.equal(shouldSpeakReply(unknownLightReply(false)), false);
  assert.equal(shouldSpeakReply(unknownLightReply(true)), false);
  assert.equal(shouldSpeakReply("กำลังเปิดไฟให้ครับ"), true);
  assert.equal(shouldSpeakReply("x".repeat(201)), false);
});

test("dynamic Thai blink details use an existing natural-voice cache line", () => {
  assert.equal(speechTextForReply("กำลังกระพริบไฟต่อเนื่องที่ความสว่าง 70 เปอร์เซ็นต์ ติด 300 และดับ 800 มิลลิวินาทีครับ"), "ตอนนี้ไฟกำลังกระพริบอยู่ครับ");
  assert.equal(speechTextForReply("กำลังกระพริบไฟ 5 ครั้ง ที่ความสว่าง 50 เปอร์เซ็นต์ ติด 100 และดับ 200 มิลลิวินาทีครับ"), "ตอนนี้ไฟกำลังกระพริบอยู่ครับ");
  assert.equal(speechTextForReply("ตอนนี้ไฟกระพริบที่ 70 เปอร์เซ็นต์ครับ ติด 0.3 วินาที ดับ 0.8 วินาที อยากปรับจังหวะก็บอกได้เลย"), "ตอนนี้ไฟกำลังกระพริบอยู่ครับ");
  assert.equal(speechTextForReply("ตอนนี้ไฟเปิดที่ 37 เปอร์เซ็นต์ครับ เป็นไฟติดค้าง ไม่ได้กระพริบ"), "ตอนนี้ไฟเปิดอยู่ที่ 37 เปอร์เซ็นต์ครับ");
  assert.equal(speechTextForReply("ตอนนี้ไฟปิดอยู่ครับ อยากให้เปิดก็บอกได้เลย"), "ตอนนี้ไฟปิดอยู่ครับ");
  assert.equal(speechTextForReply("บอร์ดรายงานความสว่าง 50 เปอร์เซ็นต์ครับ ผมยังมองไฟจริงไม่ได้ ถ้าไฟไม่ติด ลองเช็กว่า LED บนบอร์ดรุ่นนี้อยู่ที่ GPIO2 หรือเปล่าครับ"), "ผมยังมองไฟจริงไม่ได้ครับ ลองเช็ก LED บนบอร์ดที่ GPIO2 ด้วยครับ");
  assert.equal(speechTextForReply(unknownLightReply(false)), null);
});

test("Cloudflare female voice pack contains the common spoken replies", () => {
  const replies = [
    "กำลังเปิดไฟให้ครับ",
    "ไฟเปิดอยู่แล้วครับ",
    "กำลังปิดไฟให้ครับ",
    "ไฟปิดอยู่แล้วครับ",
    "กำลังปรับความสว่างเป็น 50 เปอร์เซ็นต์ให้ครับ",
    "ตอนนี้ไฟเปิดอยู่ที่ 50 เปอร์เซ็นต์ครับ",
    "ตอนนี้ไฟกำลังกระพริบอยู่ครับ",
    "ผมยังมองไฟจริงไม่ได้ครับ ลองเช็ก LED บนบอร์ดที่ GPIO2 ด้วยครับ",
  ];
  for (const reply of replies) {
    const digest = createHash("sha256").update(reply).digest("hex");
    const path = resolve("frontend/public/voice/f2-v1", `${digest}.mp3`);
    assert.ok(statSync(path).size > 512, `Missing female voice for: ${reply}`);
  }
});
