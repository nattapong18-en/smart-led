import assert from "node:assert/strict";
import test from "node:test";
import { shouldSpeakReply } from "./reply-speech.ts";
import { unknownLightReply } from "./light-help.ts";

test("guidance is shown in chat without sending oversized text to TTS", () => {
  assert.equal(shouldSpeakReply(unknownLightReply(false)), false);
  assert.equal(shouldSpeakReply(unknownLightReply(true)), false);
  assert.equal(shouldSpeakReply("กำลังเปิดไฟให้ครับ"), true);
  assert.equal(shouldSpeakReply("x".repeat(201)), false);
});
