// Live check of the local web, Pi AI fallback, and ESP32. The original LED
// state is restored in finally. Refuses to interrupt finite blink sequences.
import assert from 'node:assert/strict';

const base = process.env.LUMA_URL || 'http://127.0.0.1:3000';
let cookie = '';

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    signal: AbortSignal.timeout(35_000),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function say(message) {
  const start = Date.now();
  const result = await request('/api/assistant', { method: 'POST', body: JSON.stringify({ message }) });
  console.log(JSON.stringify({ message, reply: result.reply, brightness: result.brightness, blinking: result.blinking, onMs: result.blinkOnMs, ms: Date.now() - start }));
  return result;
}

const original = await request('/api/esp32/status');
if (original.blinking && original.blinkCount !== 0) throw new Error('Refusing to interrupt a finite blink sequence');
console.log('ORIGINAL', JSON.stringify(original));

try {
  await request('/api/esp32/light?brightness=0', { method: 'POST' });
  assert.equal((await say('เปิดไฟ')).brightness, 100);
  await request('/api/esp32/light?brightness=40', { method: 'POST' });
  assert.match((await say('เปิดไฟ')).reply, /เปิดอยู่แล้ว/);
  assert.equal((await say('หรี่ลงหน่อย')).brightness, 30);
  assert.match((await say('ไฟสว่างกี่เปอร์เซ็นต์')).reply, /30/);
  const ambiguous = await say('เปิดไฟหรือปิดไฟดี');
  assert.equal(ambiguous.brightness, 30);
  assert.match(ambiguous.reply, /ไม่รู้จัก/);
  const unrelated = await say('เล่าเรื่องตลกให้ฟัง');
  assert.equal(unrelated.brightness, 30);
  assert.match(unrelated.reply, /1\. เปิดไฟ/);
  assert.match(unrelated.reply, /5\. ตอนนี้ไฟ/);
  const invalidBrightness = await say('ตั้งความสว่าง 120%');
  assert.equal(invalidBrightness.brightness, 30);
  assert.match(invalidBrightness.reply, /ไม่รู้จัก/);
  const invalidBlinkCount = await say('กระพริบไฟ 101 ครั้ง');
  assert.equal(invalidBlinkCount.brightness, 30);
  assert.equal(invalidBlinkCount.blinking, false);
  assert.match(invalidBlinkCount.reply, /ไม่รู้จัก/);
  assert.equal((await say('กระพริบไฟช้า')).blinkOnMs, 1000);
  assert.equal((await say('ทำให้ไฟกระพริบช้าลงหน่อย')).blinkOnMs, 2000);
  const stopped = await say('หยุดไฟกระพริบ');
  assert.equal(stopped.blinking, false);
  assert.equal(stopped.brightness, 30);
  assert.equal((await say('ปิดไฟ')).brightness, 0);
  assert.match((await say('ปิดไฟ')).reply, /ปิดอยู่แล้ว/);
  assert.equal((await say('เปิดไฟในห้องให้หน่อย')).brightness, 100);
  assert.equal((await say('ปิดไฟในห้องให้ที')).brightness, 0);
  assert.equal((await say('ช่วยหรี่ไฟให้เหลือ 30%')).brightness, 30);
  const unsupported = await say('กระพริบไฟสีแดง');
  assert.equal(unsupported.brightness, 30);
  assert.equal(unsupported.blinking, false);
  assert.match((await say('ไฟเปิดอยู่แล้ว')).reply, /30/);
  console.log('PASS: local web + Pi classifier + ESP32 commands and safe rejections');
} finally {
  console.log('RESTORING original LED state');
  await request(`/api/esp32/light?brightness=${original.brightness}`, { method: 'POST' });
  if (original.blinking) {
    await request(`/api/esp32/blink?brightness=${original.blinkBrightness}&onMs=${original.blinkOnMs}&offMs=${original.blinkOffMs}&count=0`, { method: 'POST' });
  }
  const restored = await request('/api/esp32/status');
  assert.equal(restored.brightness, original.brightness);
  assert.equal(restored.blinking, original.blinking);
  if (original.blinking) {
    assert.equal(restored.blinkBrightness, original.blinkBrightness);
    assert.equal(restored.blinkOnMs, original.blinkOnMs);
    assert.equal(restored.blinkOffMs, original.blinkOffMs);
  }
  console.log('RESTORED', JSON.stringify(restored));
}
