// Smoke-test the external API without changing the physical LED.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.LUMA_URL || 'http://127.0.0.1:3100/api/v1';
const key = process.env.LUMA_API_KEY;
const origin = process.env.LUMA_TEST_ORIGIN || 'http://friend.local:5173';
if (!key) throw new Error('Set LUMA_API_KEY for the API smoke test');
const session = randomUUID();
const owner = randomUUID();

async function request(path, { method = 'GET', body, auth = true, extraHeaders = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      'X-Luma-Session': session,
      'X-Luma-Owner': owner,
      ...(auth ? { Authorization: `Bearer ${key}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  return { response, data };
}

assert.equal((await request('/status', { auth: false })).response.status, 401);
const preflight = await request('/chat', {
  method: 'OPTIONS', auth: false,
  extraHeaders: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type,x-luma-session' },
});
assert.equal(preflight.response.status, 204);
assert.equal(preflight.response.headers.get('access-control-allow-origin'), origin);

const chat = await request('/chat', { method: 'POST', body: { message: 'เล่าเรื่องตลกให้ฟัง' } });
assert.equal(chat.response.status, 200);
assert.match(chat.data.reply, /เปิดไฟ \/ ปิดไฟ/);
assert.equal(chat.response.headers.get('x-luma-session'), session);
const history = await request('/history');
assert.equal(history.response.status, 200);
assert.equal(history.data.turns.at(-1).input, 'เล่าเรื่องตลกให้ฟัง');

const invalid = await request('/light', { method: 'POST', body: { brightness: 120 } });
assert.equal(invalid.response.status, 400);

const name = `smoke-${owner.slice(0, 8)}`;
const created = await request('/presets', {
  method: 'POST', body: { name, mode: 'steady', brightness: 40, onMs: 500, offMs: 500, count: 0 },
});
assert.equal(created.response.status, 201);
try {
  const presets = await request('/presets');
  assert.equal(presets.response.status, 200);
  assert.ok(presets.data.presets.some(preset => preset.id === created.data.id));
} finally {
  const removed = await request(`/presets?id=${created.data.id}`, { method: 'DELETE' });
  assert.equal(removed.response.status, 200);
}

console.log('PASS: auth, CORS, chat, history, input validation and presets; ESP32 unchanged');
