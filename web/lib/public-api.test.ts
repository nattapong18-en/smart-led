import assert from "node:assert/strict";
import test from "node:test";
import { apiKeyIsValid, isUuid, publicApiOptions, withPublicApi } from "./public-api.ts";

test("API key rejects missing, short and incorrect values", () => {
  const key = "a".repeat(64);
  assert.equal(apiKeyIsValid(null, key), false);
  assert.equal(apiKeyIsValid("Bearer wrong", key), false);
  assert.equal(apiKeyIsValid(`Bearer ${key}`, "short"), false);
  assert.equal(apiKeyIsValid(`Bearer ${key}`, key), true);
});

test("public API fails closed and CORS only allows configured origins", async () => {
  const oldKey = process.env.LUMA_API_KEY;
  const oldOrigins = process.env.LUMA_API_ORIGINS;
  process.env.LUMA_API_KEY = "b".repeat(64);
  process.env.LUMA_API_ORIGINS = "http://friend.local:5173";
  try {
    const make = (origin: string, token = "b".repeat(64)) => new Request("http://localhost:3000/api/v1/status", {
      headers: { Origin: origin, Authorization: `Bearer ${token}` },
    });
    const denied = await withPublicApi(make("http://evil.local"), async () => Response.json({ ok: true }));
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.has("access-control-allow-origin"), false);
    const invalid = await withPublicApi(make("http://friend.local:5173", "wrong"), async () => Response.json({ ok: true }));
    assert.equal(invalid.status, 401);
    const allowed = await withPublicApi(make("http://friend.local:5173"), async () => Response.json({ ok: true }));
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "http://friend.local:5173");
    assert.equal(publicApiOptions(make("http://friend.local:5173")).status, 204);
  } finally {
    if (oldKey === undefined) delete process.env.LUMA_API_KEY; else process.env.LUMA_API_KEY = oldKey;
    if (oldOrigins === undefined) delete process.env.LUMA_API_ORIGINS; else process.env.LUMA_API_ORIGINS = oldOrigins;
  }
});

test("conversation and preset identifiers must be UUIDs", () => {
  assert.equal(isUuid("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isUuid("../../sessions"), false);
  assert.equal(isUuid(null), false);
});
