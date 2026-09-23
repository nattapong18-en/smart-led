import assert from "node:assert/strict";
import test from "node:test";

import { classifyLightIntentWithAi, shouldConsultLightAi } from "./local-light-ai.ts";
import { parseLightIntent } from "./light-intent.ts";

function ollamaResponse(content: unknown) {
  return async (_input: URL | RequestInfo, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "qwen3:0.6b");
    assert.equal(request.think, false);
    assert.equal(request.keep_alive, 0);
    assert.equal(request.options.num_ctx, 1024);
    return Response.json({ message: { content: JSON.stringify(content) } });
  };
}

test("maps local AI light actions to safe intents", async () => {
  assert.deepEqual(await classifyLightIntentWithAi("ดับไฟ", ollamaResponse({ action: "off", brightness: null })), { kind: "set", value: 0 });
  assert.deepEqual(await classifyLightIntentWithAi("turn the light on", ollamaResponse({ action: "on", brightness: null })), { kind: "set", value: 100 });
  assert.deepEqual(await classifyLightIntentWithAi("make the light 42 percent", ollamaResponse({ action: "set", brightness: 42 })), { kind: "set", value: 42 });
  assert.deepEqual(await classifyLightIntentWithAi("how is the light", ollamaResponse({ action: "status", brightness: null })), { kind: "status" });
  assert.deepEqual(await classifyLightIntentWithAi("flash five times", ollamaResponse({ action: "blink", brightness: 80, on_ms: 200, off_ms: 300, count: 5 })), { kind: "blink", brightness: 80, onMs: 200, offMs: 300, count: 5 });
  assert.deepEqual(await classifyLightIntentWithAi("stop flashing", ollamaResponse({ action: "stop_blink", brightness: null, on_ms: null, off_ms: null, count: null })), { kind: "stop-blink" });
});

test("rejects unrelated input without invoking model", async () => {
  const neverFetch: typeof fetch = async () => { throw new Error("must not call model"); };
  assert.equal(await classifyLightIntentWithAi("วันนี้อากาศดี", neverFetch), null);
  for (const unsafe of ["เปิดไฟห้องนอน", "กระพริบไฟสีแดง", "เปิดไฟแล้วปิดไฟ", "กระพริบไฟแล้วปิด"]) {
    assert.equal(await classifyLightIntentWithAi(unsafe, neverFetch), null, unsafe);
  }
});

test("speed context cannot become a power command", async () => {
  const state = { brightness: 40, on: true, blinking: true, blinkOnMs: 1000, blinkOffMs: 1000 };
  assert.equal(await classifyLightIntentWithAi("ขอจังหวะช้าลงอีกนิด", ollamaResponse({ action: "off", brightness: null }), state), null);
  assert.deepEqual(await classifyLightIntentWithAi("ขอจังหวะช้าลงอีกนิด", ollamaResponse({ action: "slower", brightness: null }), state), { kind: "blink-speed", speed: "slow" });
  assert.equal(await classifyLightIntentWithAi("ขอจังหวะช้าลงอีกนิด", ollamaResponse({ action: "slower", brightness: null }), { ...state, blinking: false }), null);
});

test("rejects unsafe or malformed model decisions", async () => {
  assert.equal(await classifyLightIntentWithAi("anything", ollamaResponse({ action: "unknown", brightness: null })), null);
  assert.equal(await classifyLightIntentWithAi("anything", ollamaResponse({ action: "set", brightness: 101 })), null);
  assert.equal(await classifyLightIntentWithAi("anything", ollamaResponse({ action: "off", brightness: 50 })), null);
  assert.equal(await classifyLightIntentWithAi("set brightness to 120 percent", ollamaResponse({ action: "set", brightness: 20 })), null);
});

test("never asks AI to repair invalid numeric requests", () => {
  for (const message of ["ตั้งความสว่าง 120%", "กระพริบไฟ 101 ครั้ง", "blink 10000 ms", "flash eleven times"]) {
    assert.equal(shouldConsultLightAi(parseLightIntent(message), message), false, message);
  }
  assert.equal(shouldConsultLightAi(parseLightIntent("เปิดไฟในห้องให้หน่อย"), "เปิดไฟในห้องให้หน่อย"), true);
});
