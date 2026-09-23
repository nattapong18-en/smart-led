# Luma API สำหรับเว็บของเพื่อน

เพื่อนทำเฉพาะหน้าเว็บได้เลย API อยู่ที่เว็บ Next.js ของเจ้าของโปรเจกต์ ไม่ต้องเรียก Pi หรือ ESP32 โดยตรง:

`BASE_URL = https://<ที่อยู่เว็บ/API ที่ deploy>/api/v1`

ตอนนี้โค้ด API พร้อมแล้ว **แต่ยังไม่มี URL deploy ที่ยืนยันว่าใช้งานจริง**; `localhost` บนเครื่องเพื่อนจะไม่ใช่เครื่องเจ้าของโปรเจกต์ ก่อนใช้งานจริงต้องมีโฮสต์ที่เปิดตลอดและเส้นทางจากโฮสต์ไป ESP32/Pi ด้วย

## การเรียกจากเบราว์เซอร์

- ทุก request ส่ง `Authorization: Bearer <LUMA_API_KEY>`; เจ้าของตั้ง `LUMA_API_KEY` อย่างน้อย 32 ตัวอักษรบนเซิร์ฟเวอร์และส่งคีย์ให้เพื่อนแบบส่วนตัว **ห้ามฝังคีย์ลง source ของเว็บหรือ GitHub** ให้หน้าเว็บถามคีย์ตอนเริ่มใช้งานและเก็บเฉพาะหน่วยความจำ/sessionStorage (หรือใช้ระบบล็อกอิน/พร็อกซีของโฮสต์ในอนาคต)
- เจ้าของตั้ง `LUMA_API_ORIGINS` ให้ตรงกับ origin ของเว็บเพื่อน เช่น `https://friend.example.com` หรือ `http://localhost:5173` สำหรับทดสอบ ถ้าไม่ได้ตั้ง เบราว์เซอร์ข้าม origin จะถูกปฏิเสธ
- สร้าง UUID ต่อการเปิดหน้าเว็บหนึ่งครั้งเป็น `X-Luma-Session` แล้วส่งซ้ำในทุก request ที่ต้องการประวัติแชตต่อเนื่อง API ส่ง UUID กลับใน response header นี้ด้วย หากไม่ส่ง ระบบสร้าง session ใหม่สำหรับ request นั้น
- หากใช้โหมดไฟที่บันทึกไว้ ให้สร้าง UUID อีกตัวหนึ่งเป็น `X-Luma-Owner` เก็บไว้ใน localStorage ของเว็บเพื่อนและส่งกับทุก request `/presets`; นี่คือรหัสเจ้าของโหมดไฟ ไม่ใช่ API key
- การเข้าจากอินเทอร์เน็ตต้องใช้ HTTPS และต้องป้องกัน route เก่า `/api/*` ที่ยังเป็นของเว็บหลักด้วย; ห้ามเปิดพอร์ต Next.js ตรงสู่สาธารณะแล้วคิดว่า API key ของ `/api/v1/*` ปกป้องทั้งเว็บ

## Endpoints

ทุก endpoint ด้านล่างอยู่ใต้ `BASE_URL` และตอบ JSON ยกเว้น `/speech` ซึ่งตอบ `audio/wav` ถ้าสำเร็จ

| Method + path | Body / ผลลัพธ์ | หน้าที่ |
| --- | --- | --- |
| `GET /status` | สถานะไฟจาก ESP32 | อ่าน `brightness`, `on`, `blinking`, `blinkBrightness`, `blinkOnMs`, `blinkOffMs`, `blinkCount` |
| `POST /chat` | `{ "message": "เปิดไฟ" }` → `{ "reply": "...", ...status }` | AI/กฎช่วยตีความไทย-อังกฤษและสั่งไฟ; บางคำตอบ เช่น วิธีใช้ อาจมีแค่ `reply` |
| `POST /light` | `{ "brightness": 0..100 }` → status | ตั้งความสว่าง; 0 คือปิด |
| `POST /blink` | `{ "brightness": 1..100, "onMs": 50..5000, "offMs": 50..5000, "count": 0..100 }` → status | กระพริบ; count 0 คือต่อเนื่อง |
| `POST /blink/stop` | ไม่มี body → status | หยุดกระพริบ |
| `POST /speech` | `{ "text": "กำลังเปิดไฟให้ครับ" }` → WAV | เสียงไทยสั้น ๆ ไม่เกิน 200 ตัวอักษร |
| `GET /history` | `{ "turns": [...], "commands": [...] }` | ประวัติของ `X-Luma-Session` ปัจจุบัน |
| `GET /presets` | `{ "presets": [...] }` | อ่านโหมดของ `X-Luma-Owner` |
| `POST /presets` | `{ "name": "อ่านหนังสือ", "mode": "steady", "brightness": 70, "onMs": 500, "offMs": 500, "count": 0 }` | บันทึกโหมด; mode เป็น `steady` หรือ `blink` |
| `POST /presets` | `{ "action": "apply", "id": 1 }` → status | ใช้โหมดที่บันทึก |
| `DELETE /presets?id=1` | `{ "ok": true }` | ลบโหมด |

ข้อผิดพลาดใช้ HTTP status จริงพร้อม `{ "error": "..." }` เช่น 400 ค่าไม่ถูก, 401 คีย์ไม่ถูก, 403 origin ไม่อนุญาต, 502 ESP32 ติดต่อไม่ได้ ห้ามแสดงว่าไฟเปลี่ยนแล้วหาก request ไม่สำเร็จ และ **ห้าม retry POST ควบคุมไฟอัตโนมัติ** หลัง timeout เพราะบอร์ดอาจทำไปแล้ว

ตัวอย่างจากเว็บเพื่อน (คีย์ต้องให้ผู้ใช้กรอกเอง):

```ts
const base = "https://<ที่อยู่เว็บ/API ที่ deploy>/api/v1";
const session = crypto.randomUUID();
const apiKey = prompt("Luma API key") ?? "";

async function luma(path: string, options: RequestInit = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Luma-Session": session,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error((await response.json()).error || `HTTP ${response.status}`);
  return response.json();
}

await luma("/chat", { method: "POST", body: JSON.stringify({ message: "กระพริบไฟช้า" }) });
```

สำหรับ `/speech` ให้ใช้ `response.blob()` แทน `.json()` แล้วเล่นด้วย `Audio(URL.createObjectURL(blob))` เบราว์เซอร์บางตัวต้องให้ผู้ใช้กดปุ่มก่อนจึงเล่นเสียงได้

## Prompt ให้เพื่อนส่งให้ AI สร้างเว็บ

> สร้างเว็บ frontend สำหรับควบคุมไฟ LED ด้วย Luma API ที่มีอยู่แล้ว ฉันทำเฉพาะ UI/UX ไม่สร้าง backend หรือ AI ใหม่ อ่านสัญญา API ใน `FRIEND_API.md` นี้ให้ครบ แล้วออกแบบหน้าเว็บตามสไตล์ที่ฉันต้องการ มีสถานะไฟแบบสด ปุ่มเปิด/ปิด สไลเดอร์ 0–100% ตั้งค่ากระพริบและหยุดกระพริบ แชตไทย/อังกฤษ ประวัติ โหมดไฟที่บันทึก และปุ่มพูดสั่งงาน/ฟังเสียงตอบกลับถ้าเบราว์เซอร์รองรับ ให้ถามผู้ใช้กรอก API URL และ API key ตอนเปิดเว็บ อย่าฝังคีย์ใน source หรือ commit ใช้ `X-Luma-Session` ใหม่ต่อการเปิดหน้า และ `X-Luma-Owner` คงเดิมสำหรับโหมดไฟ จัดการ loading/error/ESP32 offline ตาม HTTP status จริง ไม่ retry POST ควบคุมไฟโดยอัตโนมัติ และอย่าแสดงว่าไฟเปลี่ยนแล้วจน API ตอบสำเร็จ
