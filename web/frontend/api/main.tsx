import { createRoot } from "react-dom/client";
import { DEFAULT_API_URL } from "../config";
import "../../app/globals.css";
import "../site.css";

const baseUrl = `${DEFAULT_API_URL}/api/v1`;

const endpoints = [
  ["GET", "/status", "ดูสถานะไฟปัจจุบัน"],
  ["POST", "/chat", "ส่งข้อความภาษาไทยหรืออังกฤษให้ผู้ช่วยสั่งไฟ"],
  ["POST", "/light", "ตั้งความสว่าง 0–100%"],
  ["POST", "/blink", "ตั้งค่าการกระพริบ"],
  ["POST", "/blink/stop", "หยุดกระพริบ"],
  ["POST", "/speech", "รับเสียงตอบกลับแบบ WAV"],
  ["GET", "/history", "ดูประวัติของ session"],
  ["GET / POST / DELETE", "/presets", "อ่าน บันทึก ใช้ หรือลบโหมดไฟ"],
];

function ApiGuide() {
  return <main className="guide-page">
    <nav className="site-nav" aria-label="เว็บไซต์ Lumen Home"><a href="/">← หน้าควบคุมไฟ</a><a href="/api/" aria-current="page">คู่มือ API</a></nav>
    <div className="guide-hero"><p className="eyebrow">LUMEN HOME · DEVELOPER API</p><h1>ออกแบบหน้าเว็บของคุณเอง</h1><p>ทำเฉพาะ frontend แล้วเรียก API สำเร็จรูปของ Lumen Home เพื่อสั่งไฟ LED ผ่าน ESP32 ได้เลย ไม่ต้องสร้าง AI หรือ backend ใหม่</p></div>
    <section className="guide-card"><h2>เริ่มต้น</h2><p>Base URL: <code>{baseUrl}</code></p><p>ทุก request ต้องส่ง <code>Authorization: Bearer &lt;API_KEY&gt;</code> โดยรับคีย์จากเจ้าของโปรเจกต์เป็นการส่วนตัว ห้ามใส่คีย์ไว้ใน source code หรือ GitHub</p><p>สร้าง <code>X-Luma-Session</code> เป็น UUID ใหม่ทุกครั้งที่เปิดหน้า เพื่อเริ่มประวัติแชตใหม่ หากใช้ preset ให้ส่ง <code>X-Luma-Owner</code> เป็น UUID ที่เก็บไว้ในเบราว์เซอร์</p></section>
    <section className="guide-card"><h2>Endpoints</h2><div className="endpoint-list">{endpoints.map(([method, path, description]) => <div className="endpoint" key={path}><span>{method}</span><code>{path}</code><p>{description}</p></div>)}</div></section>
    <section className="guide-card"><h2>Request bodies และผลตอบกลับ</h2>
      <p><code>POST /chat</code> ส่ง <code>{'{"message":"เปิดไฟ"}'}</code> และรับ <code>reply</code> พร้อมสถานะไฟถ้ามีการสั่งงาน</p>
      <p><code>POST /light</code> ส่ง <code>{'{"brightness":70}'}</code> ค่า 0–100 โดย 0 คือปิดไฟ</p>
      <p><code>POST /blink</code> ส่ง <code>{'{"brightness":80,"onMs":200,"offMs":300,"count":5}'}</code> ความสว่าง 1–100, เวลา 50–5000 ms, count 0–100 โดย 0 คือต่อเนื่อง</p>
      <p><code>POST /blink/stop</code> ไม่ต้องส่ง body; <code>GET /status</code> และคำสั่งควบคุมไฟที่สำเร็จตอบสถานะจริงจาก ESP32</p>
      <p><code>POST /speech</code> ส่ง <code>{'{"text":"กำลังเปิดไฟให้ครับ"}'}</code> และรับ <code>audio/wav</code> แทน JSON; ข้อความไม่เกิน 200 ตัวอักษร บน Render Free ถ้าประโยคไม่มีในเสียงที่เตรียมไว้จะได้ <code>503</code> พร้อม <code>code: "tts_cache_miss"</code> ให้เว็บใช้เสียงไทยของเบราว์เซอร์แทน</p>
      <p><code>POST /presets</code> ส่ง <code>{'{"name":"อ่านหนังสือ","mode":"steady","brightness":70,"onMs":500,"offMs":500,"count":0}'}</code> หรือ <code>{'{"action":"apply","id":1}'}</code>; ลบด้วย <code>DELETE /presets?id=1</code> ทุกคำขอ preset ต้องมี <code>X-Luma-Owner</code></p>
      <p>ข้อผิดพลาดใช้ HTTP status จริง เช่น 400 ข้อมูลผิด, 401 คีย์ผิด, 403 origin ไม่อนุญาต, 502 ติดต่อ ESP32 ไม่ได้ ดู <a href="https://github.com/nattapong18-en/smart-led/blob/main/web/FRIEND_API.md" target="_blank" rel="noopener noreferrer">สัญญา API ฉบับเต็มใน GitHub ↗</a></p>
    </section>
    <section className="guide-card"><h2>ตัวอย่างเรียก API</h2><pre>{`const api = "${baseUrl}";
const key = prompt("Lumen Home API key"); // Ask at runtime
const session = crypto.randomUUID(); // Reuse until this page closes
const response = await fetch(api + "/chat", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    "X-Luma-Session": session,
  },
  body: JSON.stringify({ message: "เปิดไฟ" }),
});
if (!response.ok) throw new Error("Command failed");
console.log(await response.json());`}</pre><p>ตั้งค่า CORS บน backend ให้ตรงกับ origin ของเว็บคุณก่อน มิฉะนั้นเบราว์เซอร์จะบล็อก request อย่า retry คำสั่ง POST อัตโนมัติหลัง timeout เพราะบอร์ดอาจทำคำสั่งไปแล้ว</p></section>
    <section className="guide-card"><h2>Prompt สำหรับ AI สร้างหน้าเว็บ</h2><p>“สร้าง frontend ควบคุม LED ด้วย Lumen Home API ที่มีอยู่แล้ว รองรับสถานะไฟ เปิด/ปิด ปรับความสว่าง กระพริบ แชตไทย/อังกฤษ พูดสั่งงาน และเสียงตอบกลับ ถาม API URL กับ key จากผู้ใช้ตอนเปิดเว็บ ไม่สร้าง backend ใหม่ ไม่ฝังคีย์ลง source จัดการ error/offline และไม่แสดงว่าไฟเปลี่ยนจน API ตอบสำเร็จ”</p></section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<ApiGuide />);
