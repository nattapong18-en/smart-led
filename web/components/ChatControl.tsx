"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import VoiceControl from "./VoiceControl";
import { useReplySpeech } from "../lib/speech";
import { LIGHT_INTRO_TH } from "../lib/light-help";
import { browserApiFetch } from "../lib/browser-api";
import { shouldSpeakReply } from "../lib/reply-speech";
import { ArrowUp, AudioLines, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/button';

type ChatControlProps = {
  onCommand: (text: string) => Promise<string>;
  onHistoryReady?: () => void;
};

export default function ChatControl({ onCommand, onHistoryReady }: ChatControlProps) {
  const speech = useReplySpeech();
  const [voiceActive, setVoiceActive] = useState(false);
  const [lastReply, setLastReply] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([{ role: "ระบบ", text: LIGHT_INTRO_TH }]);
  const [historyReady, setHistoryReady] = useState(false);

  const log = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    let active = true;
    browserApiFetch('/api/history').then(response => response.json()).then(data => {
      if (!active) return;
      if (Array.isArray(data.turns)) setMessages([
        ...data.turns.filter((row: { reply: unknown }) => typeof row.reply === 'string').flatMap((row: { input: string; reply: string }) => [
          { role: 'คุณ', text: row.input }, { role: 'ระบบ', text: row.reply },
        ]),
        { role: "ระบบ", text: LIGHT_INTRO_TH },
      ]);
      setHistoryReady(true);
      onHistoryReady?.();
    }).catch(() => { if (active) { setHistoryReady(true); onHistoryReady?.(); } });
    return () => { active = false; };
  }, []);

  async function sendCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (voiceActive || !historyReady) return;
    void speech.prepare();
    await submitMessage(input);
  }

  async function submitMessage(message: string, signal?: AbortSignal): Promise<boolean> {
    const text = message.trim();
    if (!text || sending.current || signal?.aborted) return false;
    speech.stop();
    setInput("");
    setMessages((previous) => [...previous, { role: "คุณ", text }]);
    sending.current = true;
    setBusy(true);
    try {
      const reply = await onCommand(text);
      setMessages((previous) => [...previous, { role: "ระบบ", text: reply }]);
      const speakable = shouldSpeakReply(reply);
      setLastReply(speakable ? reply : "");
      if (signal?.aborted) return false;
      if (!speakable) return true;
      // A TTS failure must not cancel an otherwise successful voice command
      // or permanently stop the continuous microphone loop.
      await speech.speak(reply);
      return true;
    } catch {
      setMessages((previous) => [...previous, {
        role: "ระบบ", text: "ส่งคำสั่งไม่สำเร็จ กรุณาลองอีกครั้ง",
      }]);
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="ai-card" aria-labelledby="chat-heading">
      <div className="ai-heading"><div className="ai-icon" aria-hidden="true"><Sparkles size={19} /></div><div><p className="section-kicker">YOUR LIGHT COMPANION</p><h2 id="chat-heading">ผู้ช่วยควบคุมแสง</h2></div><span className="ai-badge"><span className="status-dot" /> LOCAL AI</span></div>
      <div ref={log} className="chat-log" role="log" aria-label="ประวัติคำสั่ง" aria-live="polite">
        {messages.map((message, index) => <div className={`message ${message.role === "คุณ" ? "user-message" : "assistant-message"}`} key={index}><span className="message-author">{message.role === "คุณ" ? "คุณ" : <><Sparkles size={11} /> ผู้ช่วย</>}</span><p>{message.text}</p></div>)}
        <div className="suggestions">{["เปิดไฟ", "ตั้งความสว่าง 50%", "กระพริบไฟช้า", "ตอนนี้ไฟเปิดอยู่ไหม"].map((text) => <button key={text} type="button" onClick={() => { setInput(text); inputRef.current?.focus(); }}>{text}<ArrowUp size={13} /></button>)}</div>
        {busy && <div className="thinking" role="status"><AudioLines size={17} className="thinking-icon" /> กำลังประมวลผลคำสั่ง…</div>}
      </div>
      <form className="chat-form" onSubmit={sendCommand}>
        <label className="sr-only" htmlFor="chat-command">ข้อความถึง AI</label>
        <div className="composer"><input ref={inputRef} id="chat-command" disabled={voiceActive || !historyReady} value={input} onChange={(event) => setInput(event.target.value)} aria-describedby="chat-help" placeholder="บอกผู้ช่วยว่าอยากได้แสงแบบไหน…" maxLength={200} />
          <VoiceControl onCommand={submitMessage} disabled={busy || !historyReady} onStartListening={() => { speech.stop(); void speech.prepare(); }} onStop={speech.stop} onActiveChange={setVoiceActive} />
          <Button type="button" variant="ghost" size="icon" className="composer-tool" disabled={!speech.supported} aria-label={speech.enabled ? 'ปิดเสียงตอบกลับ' : 'เปิดเสียงตอบกลับ'} aria-pressed={speech.enabled} onClick={speech.toggle}>{speech.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</Button>
          <Button className="send-button" size="icon" type="submit" disabled={busy || voiceActive || !historyReady || !input.trim()} aria-label={busy ? "กำลังส่งข้อความ" : "ส่งข้อความถึง AI"}>{busy ? "…" : <ArrowUp size={19} />}</Button></div>
        <div className="reply-audio" aria-label="เสียงตอบกลับ AI">
          <span className="muted" role="status">{!speech.supported ? "เบราว์เซอร์นี้ไม่รองรับเสียงอ่าน" : speech.loading ? "กำลังสร้างเสียงไทย…" : speech.speaking ? "ผู้ช่วยกำลังพูด…" : "เสียงตอบกลับพร้อมใช้งาน"}</span>
          {speech.speaking || speech.loading ? <Button type="button" variant="ghost" size="sm" onClick={speech.stop}>หยุดอ่าน</Button> : lastReply && <Button type="button" variant="ghost" size="sm" disabled={!speech.supported || !speech.enabled || busy || voiceActive} onClick={() => { void speech.prepare().then(() => speech.speak(lastReply)); }}>ฟังอีกครั้ง</Button>}
          {speech.error && <p role="alert">{speech.error}</p>}
        </div>
        <p id="chat-help" className="fine-print"><span aria-hidden="true">✦</span> ทำงานในเครื่อง ไม่ใช้ AI API · ต้องการค่าที่แน่นอน? <a href="#manual-heading">ปรับไฟเอง ↗</a></p>
      </form>
    </section>
  );
}
