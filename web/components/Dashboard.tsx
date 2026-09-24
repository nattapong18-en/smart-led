"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { getLightStatus, setBrightness, startBlink, stopBlink, type LightStatus } from "../lib/esp32";
import ChatControl from "./ChatControl";
import SavedPresets from "./SavedPresets";
import CommandHistory from "./CommandHistory";
import LampDial from "./LampDial";
import BlinkControls from "./BlinkControls";
import { Button } from "./ui/button";
import { ArrowUpRight, Bookmark, History, MessageCircle, Radio, X } from "lucide-react";
import { toast } from "sonner";
import { browserApiFetch } from "../lib/browser-api";

const tabs = [
  { id: "blink", label: "ไฟกระพริบ", icon: Radio },
  { id: "presets", label: "โหมดของฉัน", icon: Bookmark },
  { id: "history", label: "ประวัติคำสั่ง", icon: History },
] as const;
type TabId = typeof tabs[number]["id"];

function greetingFor(hour: number) {
  if (hour < 5) return "ดึกแล้ว";
  if (hour < 12) return "อรุณสวัสดิ์";
  if (hour < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

export default function Dashboard({ topbarExtra }: { topbarExtra?: ReactNode }) {
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
  const [chatOpen, setChatOpen] = useState(true);
  const [tab, setTab] = useState<TabId>("blink");
  const [greeting, setGreeting] = useState("");
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

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
    // The assistant docks beside the lamp on wide screens and waits as a bottom sheet on small ones.
    if (window.matchMedia("(max-width: 1099px)").matches) setChatOpen(false);
  }, []);

  // Ambient page glow follows the brightness confirmed by the board.
  const lamp = connection === "connected" && status ? (status.blinking ? status.blinkBrightness : status.on ? status.brightness : 0) / 100 : 0;
  const stateText = connection === "offline" ? "ติดต่อหลอดไฟไม่ได้" : connection !== "connected" || !status ? "กำลังอ่านสถานะไฟ…" : status.blinking ? `ไฟกำลังกระพริบที่ ${status.blinkBrightness}%` : status.on ? `ไฟเปิดอยู่ ${status.brightness}%` : "ไฟปิดอยู่";

  return (
    <div className={`app-shell ${chatOpen ? "chat-open" : ""}`} style={{ "--lamp": lamp } as CSSProperties}>
      <main className="room">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Lumen Home หน้าหลัก"><span className="brand-mark" aria-hidden="true" /><span>Lumen <span className="brand-home">Home</span></span></a>
          <div className="topbar-right">
            <div className={`connection ${connection}`} role="status"><span className="status-dot" /><span className="connection-text">{connection === "connected" ? "ESP32 ออนไลน์" : connection === "offline" ? "ESP32 ออฟไลน์" : "กำลังเชื่อมต่อ…"}</span></div>
            {topbarExtra}
            <button type="button" className="assistant-toggle" aria-expanded={chatOpen} aria-controls="assistant-panel" onClick={() => setChatOpen(open => !open)}>{chatOpen ? <X size={16} /> : <MessageCircle size={16} />}<span>{chatOpen ? "ซ่อนผู้ช่วย" : "ผู้ช่วย"}</span></button>
          </div>
        </header>

        <section className="stage" aria-labelledby="stage-title">
          <p className="greeting">{greeting}{greeting && " · "}<span>{stateText}</span></p>
          <h1 id="stage-title" className="sr-only">ควบคุมหลอดไฟ</h1>
          <LampDial status={status} connection={connection} brightness={brightness} busy={manualBusy} ready={historyReady} onPreview={value => { brightnessPreviewDirty.current = true; setBrightnessValue(value); }} onApply={value => { void updateBrightness(value); }} onRefresh={() => { void loadStatus(); }} />
          {error && <div className="error-banner" role="alert">{error} <Button asChild variant="ghost" size="sm"><a href="#lamp-dial">ไปที่ปรับไฟ <ArrowUpRight size={14} /></a></Button></div>}
        </section>

        <section className="modes" aria-label="โหมดและบันทึก">
          <div className="mode-tabs" role="tablist" aria-label="เลือกหมวด">
            {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className="mode-tab" onClick={() => setTab(id)}><Icon size={15} />{label}</button>)}
          </div>
          <div className="mode-panel" role="tabpanel" id="panel-blink" aria-labelledby="tab-blink" hidden={tab !== "blink"}>
            <BlinkControls brightness={blinkBrightness} onMs={blinkOnMs} offMs={blinkOffMs} count={blinkCount} busy={manualBusy} ready={historyReady} blinking={status?.blinking === true} onBrightness={setBlinkBrightness} onOnMs={setBlinkOnMs} onOffMs={setBlinkOffMs} onCount={setBlinkCount} onStart={() => { void startBlinking(); }} onStop={() => { void stopBlinking(); }} />
          </div>
          <div className="mode-panel" role="tabpanel" id="panel-presets" aria-labelledby="tab-presets" hidden={tab !== "presets"}>
            {historyReady ? <SavedPresets status={status} blinkBrightness={blinkBrightness} blinkOnMs={blinkOnMs} blinkOffMs={blinkOffMs} blinkCount={blinkCount} onApplied={data => { setStatus(data); brightnessPreviewDirty.current = false; setBrightnessValue(data.brightness); }} /> : <p className="muted">กำลังโหลด…</p>}
          </div>
          <div className="mode-panel" role="tabpanel" id="panel-history" aria-labelledby="tab-history" hidden={tab !== "history"}>
            {historyReady ? <CommandHistory /> : <p className="muted">กำลังโหลด…</p>}
          </div>
        </section>

        <footer className="footer"><span>© Lumen Home</span><span>AI ช่วยตีความ · คุณเป็นคนควบคุม</span></footer>
      </main>

      <ChatControl open={chatOpen} onClose={() => setChatOpen(false)} onCommand={handleChatCommand} onHistoryReady={() => setHistoryReady(true)} />
      {!chatOpen && <button type="button" className="assistant-fab" aria-controls="assistant-panel" aria-expanded={false} onClick={() => setChatOpen(true)}><MessageCircle size={20} /><span>คุยกับผู้ช่วย</span></button>}
    </div>
  );
}
