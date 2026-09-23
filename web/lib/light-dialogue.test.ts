import assert from "node:assert/strict";
import test from "node:test";
import { answerLightQuestion, answerStaticLightMessage } from "./light-dialogue.ts";
const state = { brightness: 40, on: true, blinking: false };
test("answers questions with live state, including blink intervals", () => {
  assert.match(answerLightQuestion("ตอนนี้สว่างเท่าไหร่", state)!, /40/);
  assert.match(answerLightQuestion("ไฟสว่างกี่เปอร์เซ็นต์", state)!, /40/);
  assert.match(answerLightQuestion("ไฟเปิดอยู่แล้ว", state)!, /40/);
  assert.match(answerLightQuestion("กระพริบเร็วแค่ไหน", { ...state, blinking: true, blinkBrightness: 70, blinkOnMs: 500, blinkOffMs: 1000 })!, /70.*0.5.*1/);
  assert.match(answerLightQuestion("ทำอะไรได้บ้าง", state)!, /เปิดไฟ \/ ปิดไฟ/);
  assert.match(answerLightQuestion("ความสว่างคืออะไร", state)!, /ร้อย/);
});
test("keeps commands on the command path and ignores unrelated conversation", () => {
  for (const text of ["เปิดไฟ", "เปิดไฟให้ผมทีได้หรือเปล่า", "กระพิบไฟเร็ว 3 ครั้ง", "เอาช้าลง", "วันนี้อากาศดี"]) assert.equal(answerLightQuestion(text, state), null, text);
  assert.equal(answerLightQuestion("กระพริบไฟให้หน่อยได้ไหม", state), null);
  assert.match(answerLightQuestion("ไฟกระพริบได้ไหม", state)!, /ยังไม่ได้เปลี่ยนไฟ/);
});
test("answers greetings and usage without a device status", () => {
  assert.match(answerStaticLightMessage("สวัสดี")!, /สวัสดีครับ/);
  assert.match(answerStaticLightMessage("help")!, /turn on the light/);
  assert.match(answerStaticLightMessage("ทำอะไรได้บ้าง")!, /1\. เปิดไฟ/);
  assert.equal(answerStaticLightMessage("เปิดไฟ"), null);
  assert.equal(answerStaticLightMessage("help me turn off the light"), null);
});
