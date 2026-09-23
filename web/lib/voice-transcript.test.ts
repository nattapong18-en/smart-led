import assert from "node:assert/strict";
import test from "node:test";

import { normalizeVoiceTranscript } from "./voice-transcript.ts";

test("repairs common Thai open-light recognition variants", () => {
  assert.equal(normalizeVoiceTranscript("เปิดไฟล์"), "เปิดไฟ");
  assert.equal(normalizeVoiceTranscript("เปิดไฟร์ให้หน่อย"), "เปิดไฟ");
});

test("repairs common Thai close-light recognition variants", () => {
  assert.equal(normalizeVoiceTranscript("ปิดไฟล์ครับ"), "ปิดไฟ");
});

test("does not rewrite unrelated speech", () => {
  assert.equal(normalizeVoiceTranscript("เปิดไฟล์เอกสาร"), "เปิดไฟล์เอกสาร");
});
