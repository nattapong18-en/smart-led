// Integration check against the Pi and connected LED. Temporarily changes the
// light and restores its original steady brightness, even after a failed check.
import assert from "node:assert/strict";
const base = process.env.LUMA_URL || "http://127.0.0.1:3000";
const request = async (path, body) => {
  const response = await fetch(base + path, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  } : { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200);
  return response.json();
};
const original = await request("/api/esp32/status");
assert.equal(original.blinking, false, "Run when the LED is not already blinking");
const history = [];
const say = async message => {
  const started = Date.now();
  const result = await request("/api/assistant", { message, history: history.slice(-4) });
  history.push({ role: "user", text: message }, { role: "model", text: result.reply });
  console.log(JSON.stringify({ message, ms: Date.now() - started, reply: result.reply, brightness: result.brightness, blinking: result.blinking, onMs: result.blinkOnMs }));
  return result;
};
try {
  assert.equal((await say("ตั้งความสว่าง 40%")).brightness, 40);
  const already = await say("เปิดไฟให้ผมทีได้หรือเปล่า");
  assert.equal(already.reply, "ไฟเปิดอยู่แล้วครับ");
  assert.equal(already.brightness, 40);
  for (const message of ["วันนี้อากาศดี", "อย่าปิดไฟ", "เล่าเรื่องไฟกระพริบ", "xyzzy"]) {
    const rejected = await say(message);
    assert.equal(rejected.reply, message === "xyzzy" ? "Unknown command." : "ไม่รู้จักคำสั่งนี้ครับ");
    assert.equal(rejected.brightness, 40);
    assert.equal(rejected.blinking, false);
  }
  assert.equal((await say("กระพิบไฟ")).blinking, true);
  assert.equal((await say("ขอจังหวะช้าลงอีกนิด")).blinkOnMs, 1000);
  assert.equal((await say("ขอจังหวะช้าลงอีกนิด")).blinkOnMs, 2000);
  assert.equal((await say("could you make it faster please")).blinkOnMs, 1000);
  assert.equal((await say("หยุดกระพิบไฟ")).brightness, 40);
  assert.equal((await say("ปิดไฟ")).brightness, 0);
  assert.equal((await say("ปิดไฟ")).reply, "ไฟปิดอยู่แล้วครับ");
  console.log("PASS: contextual AI, Thai/English, repeated commands, rejection and hardware state");
} finally {
  await say(`ตั้งความสว่าง ${original.brightness}%`);
}
