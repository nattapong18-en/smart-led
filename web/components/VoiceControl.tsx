"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeVoiceTranscript } from "../lib/voice-transcript";
import { parseLightIntent } from "../lib/light-intent";
import { Mic, Square } from 'lucide-react';
import { Button } from './ui/button';

type VoiceControlProps = {
  onCommand: (text: string, signal?: AbortSignal) => Promise<boolean>;
  disabled?: boolean;
  onStartListening?: () => void;
  onStop?: () => void;
  onActiveChange?: (active: boolean) => void;
};

function recognitionErrorMessage(code: string) {
  if (code === "not-allowed" || code === "service-not-allowed") return "Chrome ไม่ได้รับอนุญาตใช้ไมโครโฟน กรุณาอนุญาตในตั้งค่าเว็บไซต์";
  if (code === "audio-capture") return "Chrome หาไมโครโฟนไม่พบ ตรวจไมค์และสิทธิ์ของอุปกรณ์";
  if (code === "network") return "บริการรู้จำเสียงของ Chrome ติดต่อเครือข่ายไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่";
  if (code === "no-speech") return "ยังไม่ได้ยินเสียง กดไมค์แล้วพูดอีกครั้ง";
  if (code === "language-not-supported") return "Chrome ไม่รองรับภาษาเสียงที่เลือก ลองเปลี่ยน TH/EN";
  return "รับเสียงไม่สำเร็จ กดเริ่มคุยอีกครั้งได้เลย";
}

export default function VoiceControl({ onCommand, disabled = false, onStartListening, onStop, onActiveChange }: VoiceControlProps) {
  const [active, setActive] = useState(false);
  const [recognitionLanguage, setRecognitionLanguage] = useState("th-TH");
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [heard, setHeard] = useState("");
  const [submitted, setSubmitted] = useState("");
  const recognition = useRef<any>(null);
  const session = useRef<AbortController | null>(null);
  const callback = useRef(onCommand);
  callback.current = onCommand;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cleanup() {
    session.current?.abort();
    session.current = null;
    if (timer.current) clearTimeout(timer.current);
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onend = null;
      current.onresult = null;
      current.onerror = null;
      current.abort();
    }
  }

  useEffect(() => () => cleanup(), []);

  function stop() {
    cleanup();
    onStop?.();
    setActive(false);
    onActiveChange?.(false);
    setPhase("idle");
  }

  function listen(controller: AbortController) {
    if (controller.signal.aborted) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const current = new SpeechRecognition();
    recognition.current = current;
    current.lang = recognitionLanguage;
    current.interimResults = false;
    current.continuous = false;
    current.maxAlternatives = 5;
    let received = false;
    let transcript = "";
    setPhase("listening");
    setHeard("");
    setSubmitted("");
    current.onresult = (event: any) => {
      if (controller.signal.aborted) return;
      const alternatives: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        for (let j = 0; j < event.results[i].length; j++) {
          alternatives.push(event.results[i][j].transcript.trim());
        }
      }
      if (!alternatives.length) return;
      received = true;
      const first = alternatives[0];
      transcript = alternatives
        .map(normalizeVoiceTranscript)
        .find((candidate) => parseLightIntent(candidate).kind !== "error") ?? first;
      setHeard(first);
      current.stop();
    };
    current.onerror = (event: any) => {
      if (controller.signal.aborted) return;
      setError(recognitionErrorMessage(event.error));
      stop();
    };
    current.onend = async () => {
      recognition.current = null;
      if (controller.signal.aborted) return;
      if (!received || !transcript.trim()) {
        setError("ยังไม่ได้ยินเสียง กดเริ่มคุยเมื่อพร้อม");
        stop();
        return;
      }
      setPhase("replying");
      try {
        const normalized = normalizeVoiceTranscript(transcript);
        setSubmitted(normalized);
        const ok = await callback.current(normalized, controller.signal);
        if (controller.signal.aborted) return;
        if (!ok) { stop(); return; }
        // Wait for playback to finish, then reopen the mic without capturing the reply.
        timer.current = setTimeout(() => listen(controller), 350);
      } catch {
        if (!controller.signal.aborted) { setError("ส่งคำสั่งไม่สำเร็จ กรุณาลองอีกครั้ง"); stop(); }
      }
    };
    try { current.start(); } catch {
      setError("เปิดไมโครโฟนไม่สำเร็จ กรุณาลองอีกครั้ง");
      stop();
    }
  }

  function start() {
    if (disabled || session.current) return;
    setError("");
    if (!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) {
      setError("เบราว์เซอร์นี้ไม่รองรับคำสั่งเสียง กรุณาพิมพ์แทน");
      return;
    }
    onStartListening?.();
    const controller = new AbortController();
    session.current = controller;
    setActive(true);
    onActiveChange?.(true);
    listen(controller);
  }

  return (
    <div className={`voice-control conversation ${active ? "conversation-active" : ""}`}>
      <label className="sr-only" htmlFor="voice-language">ภาษาเสียง</label><select id="voice-language" className="voice-language" value={recognitionLanguage} disabled={active} onChange={(event) => setRecognitionLanguage(event.target.value)} aria-label="ภาษาเสียง"><option value="th-TH">TH</option><option value="en-US">EN</option></select>
      <Button type="button" variant="ghost" size="icon" className="composer-tool mic-button" onClick={active ? stop : start} disabled={!active && disabled} aria-label={active ? "จบการสนทนา" : "เริ่มคุยต่อเนื่อง"} aria-pressed={active}>{active ? <Square size={15} fill="currentColor" /> : <Mic size={18} />}</Button>
      {(active || error || heard) && <div className="voice-popover" role="status"><span>{phase === "listening" ? "● กำลังฟัง พูดได้เลย…" : phase === "replying" ? "AI กำลังตอบ · ตอบจบจะฟังต่อ" : "กดไมค์เพื่อคุยต่อเนื่อง"}</span>{heard && <p className="voice-transcript">ได้ยิน: “{heard}”{submitted && submitted !== heard && <span> → ส่ง: “{submitted}”</span>}</p>}{error && <p role="alert">{error}</p>}</div>}
    </div>
  );
}
