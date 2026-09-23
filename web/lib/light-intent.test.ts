import assert from "node:assert/strict";
import test from "node:test";

import { parseLightIntent } from "./light-intent.ts";

const cases = [
  ["เปิดไฟ", { kind: "set", value: 100 }],
  ["สั่งให้เปิดไฟ", { kind: "set", value: 100 }],
  ["สั้งให้เปิดไฟ", { kind: "set", value: 100 }],
  ["ช่วยสั่งเปิดไฟให้หน่อย", { kind: "set", value: 100 }],
  ["เปิดไฟสิ", { kind: "set", value: 100 }],
  ["เปิดไฟเดี๋ยวนี้", { kind: "set", value: 100 }],
  ["ช่วยปิดไฟให้หน่อย", { kind: "set", value: 0 }],
  ["turn the lamp on please", { kind: "set", value: 100 }],
  ["dim the lights a bit", { kind: "adjust", value: -10 }],
  ["ช่วยเปิดหลอดให้ที", { kind: "set", value: 100 }],
  ["ปิดหลอดตรงนี้หน่อย", { kind: "set", value: 0 }],
  ["สว่างขึ้นอีกนิด", { kind: "adjust", value: 10 }],
  ["ขอไฟสว่างขึ้นอีกนิด", { kind: "adjust", value: 10 }],
  ["หรี่ลงหน่อย", { kind: "adjust", value: -10 }],
  ["ช่วยหรี่ไฟให้เหลือ 30%", { kind: "set", value: 30 }],
  ["ปรับไฟให้เหลือ 25 เปอร์เซ็นต์", { kind: "set", value: 25 }],
  ["ตั้งความสว่าง 70%", { kind: "set", value: 70 }],
  ["turn on the light", { kind: "set", value: 100 }],
  ["Please turn off the lights", { kind: "set", value: 0 }],
  ["help me turn off the light", { kind: "set", value: 0 }],
  ["set brightness to 45 percent", { kind: "set", value: 45 }],
  ["brighter", { kind: "adjust", value: 10 }],
  ["turn it down by 20 percent", { kind: "adjust", value: -20 }],
  ["light status", { kind: "status" }],
  ["กระพริบไฟเร็ว 5 ครั้ง", { kind: "blink", brightness: 100, onMs: 200, offMs: 200, count: 5 }],
  ["กระพิบไฟ", { kind: "blink", brightness: 100, onMs: 500, offMs: 500, count: 0 }],
  ["กะพิบไฟเร็ว 3 ครั้ง", { kind: "blink", brightness: 100, onMs: 200, offMs: 200, count: 3 }],
  ["กระพริบไฟช้า ความสว่าง 70%", { kind: "blink", brightness: 70, onMs: 1000, offMs: 1000, count: 0 }],
  ["blink every 2 seconds 3 times", { kind: "blink", brightness: 100, onMs: 2000, offMs: 2000, count: 3 }],
  ["flash five times", { kind: "blink", brightness: 100, onMs: 500, offMs: 500, count: 5 }],
  ["blink 7x", { kind: "blink", brightness: 100, onMs: 500, offMs: 500, count: 7 }],
  ["blink slowly 2 times at 40 percent", { kind: "blink", brightness: 40, onMs: 1000, offMs: 1000, count: 2 }],
  ["กระพริบไฟ 4 ครั้ง ที่ 75%", { kind: "blink", brightness: 75, onMs: 500, offMs: 500, count: 4 }],
  ["หยุดกระพริบไฟ", { kind: "stop-blink" }],
  ["หยุดกระพิบไฟ", { kind: "stop-blink" }],
  ["หยุดไฟกระพริบ", { kind: "stop-blink" }],
  ["stop blinking", { kind: "stop-blink" }],
  ["เอาช้าๆ", { kind: "blink-speed", speed: "slow" }],
  ["ช้าลงหน่อย", { kind: "blink-speed", speed: "slow" }],
  ["เอาเร็วๆ", { kind: "blink-speed", speed: "fast" }],
  ["faster", { kind: "blink-speed", speed: "fast" }],
  ["ความเร็วปกติ", { kind: "blink-speed", speed: "normal" }],
  ["ทำให้ไฟกระพริบช้าลงหน่อย", { kind: "blink-speed", speed: "slow" }],
  ["ไฟกระพริบเร็วขึ้น", { kind: "blink-speed", speed: "fast" }],
  ["make the light blink slower", { kind: "blink-speed", speed: "slow" }],
] as const;

for (const [command, expected] of cases) {
  test(command, () => assert.deepEqual(parseLightIntent(command), expected));
}

test("does not execute a negated command", () => {
  assert.equal(parseLightIntent("don't turn on the light").kind, "error");
});

for (const unknown of ["เปิดอะไรสักอย่าง", "วันนี้อากาศดี", "ทำให้หน่อย", "xyzzy", "กระพริบไฟแล้วปิด", "กระพริบไฟสีแดง", "เปิดไฟห้องนอน", "เปิดไฟแล้วปิดไฟ", "flash eleven times", "กระพริบไฟหลายครั้ง"]) {
  test(`does not guess unknown command: ${unknown}`, () => {
    assert.equal(parseLightIntent(unknown).kind, "error");
  });
}
