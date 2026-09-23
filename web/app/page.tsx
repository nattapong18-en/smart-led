"use client";

import { useEffect, useRef, useState } from "react";
import { getLightStatus, setBrightness, startBlink, stopBlink, type LightStatus } from "../lib/esp32";
import ChatControl from "../components/ChatControl";
import SavedPresets from "../components/SavedPresets";
import CommandHistory from "../components/CommandHistory";
import LightStatusPanel from "../components/LightStatusPanel";
import ManualControls from "../components/ManualControls";
import BlinkControls from "../components/BlinkControls";
import { Button } from "../components/ui/button";
import { Activity, ArrowUpRight, Cpu, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { browserApiFetch } from "../lib/browser-api";

export default function Home() {
  const [status, setStatus] = useState<LightStatus | null>(null);
  const [brightness, setBrightnessValue] = useState(0);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("checking");
  const [manualBusy, setManualBusy] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [blinkBrightness, setBlinkBrightness] = useState(100);
  const [blinkOnMs, setBlinkOnMs] = useState(300);
  const [blinkOffMs, setBlinkOffMs] = useState(300);
  const [blinkCount, setBlinkCount] = useState(0);
  const statusRequestInFlight = useRef(false);
  const brightnessPreviewDirty = useRef(false);

  async function loadStatus() {
    if (statusRequestInFlight.current) return;
    statusRequestInFlight.current = true;
    try {
      const data = await getLightStatus();

      setConnection("connected");
      setStatus(data);
      if (!brightnessPreviewDirty.current) setBrightnessValue(data.brightness);
      setError(current => current === "เชื่อมต่อ ESP32 ไม่ได้" ? "" : current);
    } catch (err) {
      setConnection("offline");
      setError("เชื่อมต่อ ESP32 ไม่ได้");
    } finally {
      statusRequestInFlight.current = false;
    }
  }

  async function updateBrightness(value: number) {
    if (!historyReady) return false;
    setManualBusy(true);
    try {
      setError("");

      const data = await setBrightness(value);

      setConnection("connected");
      setStatus(data);
      brightnessPreviewDirty.current = false;
      setBrightnessValue(data.brightness);
      toast.success(value === 0 ? "ปิดไฟแล้ว" : `ปรับความสว่างเป็น ${data.brightness}% แล้ว`);
      return true;
    } catch (err) {
      setConnection("offline");
      setError("ปรับความสว่างไม่สำเร็จ");
      toast.error("ปรับความสว่างไม่สำเร็จ");
      return false;
    } finally {
      setManualBusy(false);
    }
  }

  async function startBlinking() {
    if (!historyReady) return;
    setManualBusy(true);
    try {
      setError("");
      const data = await startBlink(blinkBrightness, blinkOnMs, blinkOffMs, blinkCount);
      setConnection("connected");
      setStatus(data);
      toast.success("เริ่มไฟกระพริบแล้ว");
    } catch (err) {
      setError("เริ่มไฟกระพริบไม่สำเร็จ");
      toast.error("เริ่มไฟกระพริบไม่สำเร็จ");
    } finally {
      setManualBusy(false);
    }
  }

  async function stopBlinking() {
    if (!historyReady) return;
    setManualBusy(true);
    try {
      setError("");
      const data = await stopBlink();
      setConnection("connected");
      setStatus(data);
      brightnessPreviewDirty.current = false;
      setBrightnessValue(data.brightness);
      toast.success("หยุดไฟกระพริบแล้ว");
    } catch (err) {
      setError("หยุดไฟกระพริบไม่สำเร็จ");
      toast.error("หยุดไฟกระพริบไม่สำเร็จ");
    } finally {
      setManualBusy(false);
    }
  }

  const commandBusy = useRef(false);
  const conversation = useRef<{ role: "user" | "model"; text: string }[]>([]);

  async function handleChatCommand(text: string): Promise<string> {
    if (commandBusy.current) return "กำลังส่งคำสั่งก่อนหน้า กรุณารอสักครู่แล้วลองใหม่";
    commandBusy.current = true;
    setError("");
    try {
      const response = await browserApiFetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: conversation.current }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ส่งข้อความถึง AI ไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      if (typeof data.reply !== "string" ||
          (data.on !== undefined && typeof data.on !== "boolean") ||
          (data.brightness !== undefined && (!Number.isInteger(data.brightness) || data.brightness < 0 || data.brightness > 100)) ||
          ((data.on === undefined) !== (data.brightness === undefined))) {
        throw new Error("คำตอบจาก AI ไม่สมบูรณ์ กรุณาลองอีกครั้ง");
      }
      if (typeof data.on === "boolean" && typeof data.brightness === "number") {
        setConnection("connected");
        setStatus({
        brightness: data.brightness,
        on: data.on,
        blinking: data.blinking === true,
        blinkOutputOn: data.blinkOutputOn === true,
        blinkBrightness: Number.isInteger(data.blinkBrightness) ? data.blinkBrightness : 100,
        blinkOnMs: Number.isInteger(data.blinkOnMs) ? data.blinkOnMs : 500,
        blinkOffMs: Number.isInteger(data.blinkOffMs) ? data.blinkOffMs : 500,
        blinkCount: Number.isInteger(data.blinkCount) ? data.blinkCount : 0,
        blinkRemaining: Number.isInteger(data.blinkRemaining) ? data.blinkRemaining : 0,
        });
        brightnessPreviewDirty.current = false;
        setBrightnessValue(data.brightness);
      }
      conversation.current = [...conversation.current, { role: "user" as const, text }, { role: "model" as const, text: data.reply }].slice(-12);
      return data.reply;
    } catch (err) {
      const message = err instanceof Error ? err.message : "ส่งข้อความถึง AI ไม่สำเร็จ กรุณาลองอีกครั้ง";
      setError(message);
      throw new Error(message);
    } finally {
      commandBusy.current = false;
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    const interval = connection === "connected" && !status?.blinking ? 10_000 : 3_000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadStatus();
    }, interval);
    const onVisible = () => { if (document.visibilityState === "visible") void loadStatus(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [connection, status?.blinking]);

  return (
    <main className="dashboard">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Luma หน้าหลัก"><span className="brand-mark" aria-hidden="true"><Sparkles size={18} strokeWidth={1.8} /></span><span>luma</span><span className="brand-caption">SMART LIGHT</span></a>
        <div className="topbar-right"><span className="topbar-label"><Cpu size={14} /> LOCAL CONTROL</span><div className={`connection ${connection}`} role="status"><span className="status-dot" />{connection === "connected" ? "ESP32 เชื่อมต่อแล้ว" : connection === "offline" ? "ESP32 ไม่ได้เชื่อมต่อ" : "กำลังเชื่อมต่อ…"}</div></div>
      </header>
      <div className="page-intro"><div><p className="eyebrow"><Activity size={13} /> LIGHT CONTROL CENTER</p><h1>พื้นที่ของแสง<span className="title-period">.</span></h1><p>พูดคุยกับผู้ช่วย หรือปรับแสงด้วยตัวเองในที่เดียว</p></div><span className="intro-index">01 / DASHBOARD</span></div>
      <div className="workspace">
        <ChatControl onCommand={handleChatCommand} onHistoryReady={() => setHistoryReady(true)} />
        <aside className="side-stack" aria-label="สถานะและการควบคุมไฟ">
          <LightStatusPanel status={status} connection={connection} previewBrightness={brightness} onRefresh={loadStatus} />
          <ManualControls brightness={brightness} busy={manualBusy} ready={historyReady} onPreview={value => { brightnessPreviewDirty.current = true; setBrightnessValue(value); }} onApply={value => { void updateBrightness(value); }} />
          <BlinkControls brightness={blinkBrightness} onMs={blinkOnMs} offMs={blinkOffMs} count={blinkCount} busy={manualBusy} ready={historyReady} blinking={status?.blinking === true} onBrightness={setBlinkBrightness} onOnMs={setBlinkOnMs} onOffMs={setBlinkOffMs} onCount={setBlinkCount} onStart={() => { void startBlinking(); }} onStop={() => { void stopBlinking(); }} />
          {historyReady && <SavedPresets status={status} blinkBrightness={blinkBrightness} blinkOnMs={blinkOnMs} blinkOffMs={blinkOffMs} blinkCount={blinkCount} onApplied={data => { setStatus(data); brightnessPreviewDirty.current = false; setBrightnessValue(data.brightness); }} />}
          {historyReady && <CommandHistory />}
        </aside>
      </div>
      {error && <div className="error-banner" role="alert">{error} <Button asChild variant="ghost" size="sm"><a href="#manual-heading">ไปที่ปรับไฟ <ArrowUpRight size={14} /></a></Button></div>}
      <footer className="footer"><span>© LUMA · LIGHT MADE SIMPLE</span><span>AI ช่วยตีความ · คุณเป็นคนควบคุม</span></footer>
    </main>
  );
}
