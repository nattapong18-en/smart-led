import assert from "node:assert/strict";
import test from "node:test";
import { LIGHT_INTRO_TH, unknownLightReply } from "./light-help.ts";

test("welcome introduces the assistant and shows actionable examples", () => {
  assert.match(LIGHT_INTRO_TH, /ผม Luma/);
  assert.match(LIGHT_INTRO_TH, /กดปุ่มไมโครโฟน/);
  for (const example of ["เปิดไฟ", "ตั้งความสว่าง 50%", "กระพริบไฟช้า", "หยุดกระพริบไฟ", "ไฟสว่างกี่เปอร์เซ็นต์"]) {
    assert.ok(LIGHT_INTRO_TH.includes(example), example);
  }
});

test("unknown commands return scoped Thai and English examples", () => {
  const thai = unknownLightReply(false);
  const english = unknownLightReply(true);
  assert.match(thai, /ไม่รู้จักคำสั่งนี้/);
  assert.match(thai, /1\. เปิดไฟ/);
  assert.match(thai, /5\. ตอนนี้ไฟ/);
  assert.match(thai, /กดปุ่มไมโครโฟน/);
  assert.match(english, /I don't know that command/);
  assert.match(english, /blink fast 5 times/);
});
