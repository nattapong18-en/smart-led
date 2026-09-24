import { useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import Dashboard from "../components/Dashboard";
import { clearExternalApi, configureExternalApi, enableExternalApiMode, savedExternalApiUrl } from "../lib/browser-api";
import { DEFAULT_API_URL } from "./config";
import "../app/globals.css";
import "./site.css";

enableExternalApiMode();

function App() {
  const [connected, setConnected] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => savedExternalApiUrl() || DEFAULT_API_URL);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      configureExternalApi(apiUrl, apiKey);
      setApiKey("");
      setError("");
      setConnected(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ตั้งค่าการเชื่อมต่อไม่สำเร็จ");
    }
  }

  return <>
    {connected ? <Dashboard topbarExtra={<nav className="topbar-links" aria-label="เว็บไซต์ Lumen Home">
      <a href="/api/" target="_blank" rel="noopener noreferrer">คู่มือ API ↗</a>
      <button type="button" onClick={() => { clearExternalApi(); setConnected(false); }}>เปลี่ยนการเชื่อมต่อ</button>
    </nav>} /> : <><nav className="site-nav" aria-label="เว็บไซต์ Lumen Home">
      <a href="/" aria-current="page">ควบคุมไฟ</a>
      <a href="/api/" target="_blank" rel="noopener noreferrer">คู่มือ API สำหรับเพื่อน ↗</a>
    </nav><main className="connect-page">
      <div className="connect-card">
        <p className="eyebrow">LUMEN HOME · SMART LIGHT</p>
        <h1>เชื่อมต่อระบบควบคุมไฟ</h1>
        <p>ใส่ URL ของ API บน Render และคีย์ที่เจ้าของโปรเจกต์ให้มา จากนั้นใช้แชต เสียง และปุ่มควบคุมไฟได้ในหน้านี้</p>
        <form onSubmit={connect}>
          <label>API URL<input type="url" value={apiUrl} onChange={event => setApiUrl(event.target.value)} placeholder="https://your-api.onrender.com" required autoComplete="url" /></label>
          <label>API key<input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Bearer key" required autoComplete="off" /></label>
          {error && <p className="connect-error" role="alert">{error}</p>}
          <button type="submit">เข้าสู่หน้าควบคุม</button>
        </form>
        <p className="connect-note">คีย์อยู่ในหน่วยความจำของแท็บนี้เท่านั้น เมื่อรีเฟรชหรือปิดแท็บต้องกรอกใหม่ ประวัติแชตหน้าเว็บจะเริ่มใหม่เช่นกัน</p>
      </div>
    </main></>}
    <Toaster richColors position="top-right" />
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);
