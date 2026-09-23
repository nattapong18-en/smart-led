import assert from "node:assert/strict";
import test from "node:test";
import { browserApiFetch, configureExternalApi, enableExternalApiMode, mapLegacyApiRequest } from "./browser-api.ts";

test("maps first-party commands to the public API without changing their meaning", () => {
  const light = mapLegacyApiRequest("/api/esp32/light?brightness=70", { method: "POST" });
  assert.equal(light.path, "/light");
  assert.deepEqual(JSON.parse(String(light.init.body)), { brightness: 70 });

  const blink = mapLegacyApiRequest("/api/esp32/blink?brightness=80&onMs=200&offMs=300&count=5", { method: "POST" });
  assert.equal(blink.path, "/blink");
  assert.deepEqual(JSON.parse(String(blink.init.body)), { brightness: 80, onMs: 200, offMs: 300, count: 5 });

  assert.equal(mapLegacyApiRequest("/api/assistant", { method: "POST" }).path, "/chat");
  assert.equal(mapLegacyApiRequest("/api/speech", { method: "POST" }).path, "/speech");
  assert.equal(mapLegacyApiRequest("/api/presets?id=12", { method: "DELETE" }).path, "/presets?id=12");
  assert.equal(mapLegacyApiRequest("/api/presets").presets, true);
});

test("does not forward arbitrary paths or remote URLs with the API key", () => {
  assert.throws(() => mapLegacyApiRequest("https://example.com/steal"));
  assert.throws(() => mapLegacyApiRequest("/api/admin"));
  assert.throws(() => mapLegacyApiRequest("/api/esp32/light?brightness=70", { method: "GET" }));
});

test("external browser calls send the key only to the configured API origin", async () => {
  const stored = new Map<string, string>();
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem: (key: string) => stored.get(key) || null, setItem: (key: string, value: string) => stored.set(key, value) } },
  });
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init: init || {} });
    return Response.json({ ok: true });
  };
  try {
    enableExternalApiMode();
    configureExternalApi("https://luma-api.onrender.com", "test-key");
    await browserApiFetch("/api/esp32/status");
    assert.equal(calls[0].url, "https://luma-api.onrender.com/api/v1/status");
    const headers = new Headers(calls[0].init.headers);
    assert.equal(headers.get("Authorization"), "Bearer test-key");
    assert.ok(headers.get("X-Luma-Session"));
    assert.equal(stored.get("luma-api-url"), "https://luma-api.onrender.com");
    assert.equal([...stored.values()].includes("test-key"), false);
    assert.throws(() => mapLegacyApiRequest("https://attacker.example/"));
  } finally {
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});
