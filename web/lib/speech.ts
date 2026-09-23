"use client";

import { useEffect, useRef, useState } from "react";
import { browserApiFetch } from "./browser-api";

export function useReplySpeech() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const enabledRef = useRef(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const finish = useRef<((played: boolean) => void) | null>(null);
  const objectUrl = useRef<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);

  function settle(played: boolean) {
    finish.current?.(played);
    finish.current = null;
  }

  function stop() {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    if (utterance.current) {
      utterance.current.onstart = null;
      utterance.current.onend = null;
      utterance.current.onerror = null;
    }
    window.speechSynthesis?.cancel();
    if (audio.current) {
      // Removing src can dispatch an error later. Detach callbacks first so
      // finishing/cancelling a successful clip cannot report a playback error.
      audio.current.onplay = null;
      audio.current.onended = null;
      audio.current.onerror = null;
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current.load();
      audio.current = null;
    }
    utterance.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    settle(false);
    setSpeaking(false);
    setLoading(false);
  }

  async function prepare() {
    setError("");
  }

  useEffect(() => {
    setSupported("Audio" in window || "speechSynthesis" in window);
    return () => stop();
  }, []);

  async function speakThai(text: string): Promise<boolean> {
    const ticket = generation.current;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    try {
      const response = await browserApiFetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("local TTS unavailable");
      const blob = await response.blob();
      if (ticket !== generation.current) return false;
      if (!response.headers.get("content-type")?.startsWith("audio/") || blob.size < 44) throw new Error("invalid audio");
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      const current = new Audio(url);
      audio.current = current;

      return await new Promise<boolean>((resolve) => {
        finish.current = resolve;
        current.onplay = () => { setLoading(false); setSpeaking(true); };
        current.onended = () => { finish.current = null; stop(); resolve(true); };
        current.onerror = () => { finish.current = null; stop(); setError("เล่นเสียงไทยไม่สำเร็จ"); resolve(false); };
        current.play().catch(() => {
          if (ticket !== generation.current) { resolve(false); return; }
          finish.current = null;
          stop();
          setError("เบราว์เซอร์บล็อกเสียง กรุณากดฟังอีกครั้ง");
          resolve(false);
        });
      });
    } catch {
      if (controller.signal.aborted || ticket !== generation.current) return false;
      setLoading(false);
      setError("สร้างเสียงไทยไม่สำเร็จ");
      return false;
    }
  }

  async function speakEnglish(text: string): Promise<boolean> {
    if (!("speechSynthesis" in window)) return false;
    return await new Promise<boolean>((resolve) => {
      const current = new SpeechSynthesisUtterance(text);
      current.lang = "en-US";
      current.rate = 1;
      utterance.current = current;
      finish.current = resolve;
      current.onstart = () => setSpeaking(true);
      current.onend = () => { finish.current = null; stop(); resolve(true); };
      current.onerror = () => { finish.current = null; stop(); setError("เบราว์เซอร์เล่นเสียงอังกฤษไม่สำเร็จ"); resolve(false); };
      window.speechSynthesis.speak(current);
    });
  }

  async function speak(text: string): Promise<boolean> {
    if (!enabledRef.current) return true;
    if (!text.trim()) return false;
    stop();
    setError("");
    return /[฀-๿]/.test(text) ? speakThai(text) : speakEnglish(text);
  }

  function toggle() {
    enabledRef.current = !enabledRef.current;
    setEnabled(enabledRef.current);
    if (!enabledRef.current) stop();
    setError("");
  }

  return { supported, enabled, speaking, loading, error, speak, stop, toggle, prepare };
}
