"use client";

import { useEffect, useRef, useState } from "react";
import { browserApiFetch, externalApiConfigured } from "./browser-api";

const VOICE_PACK = "f2-v1";

export function useReplySpeech() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"static" | "server" | "browser" | null>(null);
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

  async function playClip(blob: Blob, ticket: number, clipSource: "static" | "server"): Promise<boolean> {
    if (ticket !== generation.current) return false;
    const url = URL.createObjectURL(blob);
    objectUrl.current = url;
    let current: HTMLAudioElement;
    try {
      current = new Audio(url);
    } catch {
      URL.revokeObjectURL(url);
      objectUrl.current = null;
      return false;
    }
    audio.current = current;
    const release = () => {
      current.onplay = null;
      current.onended = null;
      current.onerror = null;
      current.pause();
      current.removeAttribute("src");
      current.load();
      if (audio.current === current) audio.current = null;
      if (objectUrl.current === url) {
        URL.revokeObjectURL(url);
        objectUrl.current = null;
      }
      setSource(null);
      setSpeaking(false);
    };
    return await new Promise<boolean>((resolve) => {
      finish.current = resolve;
      current.onplay = () => { setSource(clipSource); setLoading(false); setSpeaking(true); };
      current.onended = () => { finish.current = null; stop(); resolve(true); };
      current.onerror = () => { finish.current = null; release(); resolve(false); };
      try {
        void current.play().catch(() => {
          if (ticket !== generation.current) { resolve(false); return; }
          finish.current = null;
          release();
          resolve(false);
        });
      } catch {
        finish.current = null;
        release();
        resolve(false);
      }
    });
  }

  async function staticThaiClip(text: string): Promise<Blob | null> {
    if (!externalApiConfigured() || !window.crypto?.subtle) return null;
    let digest: string;
    try {
      const hash = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      digest = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
    } catch {
      return null;
    }
    const controller = new AbortController();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await fetch(`/voice/${VOICE_PACK}/${digest}.mp3`, { cache: "force-cache", signal: controller.signal });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/")) return null;
      const blob = await response.blob();
      return blob.size >= 512 ? blob : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) pending.current = null;
    }
  }

  async function serverThaiClip(text: string): Promise<Blob | null> {
    const controller = new AbortController();
    pending.current = controller;
    // Render Free may be asleep; keep the UI responsive while it wakes up.
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await browserApiFetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/")) return null;
      const blob = await response.blob();
      return blob.size >= 44 ? blob : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) pending.current = null;
    }
  }

  async function speakThai(text: string): Promise<boolean> {
    const ticket = generation.current;
    setLoading(true);
    try {
      const staticClip = await staticThaiClip(text);
      if (ticket !== generation.current) return false;
      if (staticClip && await playClip(staticClip, ticket, "static")) return true;
      if (ticket !== generation.current) return false;

      setLoading(true);
      const serverClip = await serverThaiClip(text);
      if (ticket !== generation.current) return false;
      if (serverClip && await playClip(serverClip, ticket, "server")) return true;
      if (ticket !== generation.current) return false;
    } catch {
      if (ticket !== generation.current) return false;
    }
    setLoading(false);
    return await speakBrowser(text, "th-TH");
  }

  async function speakBrowser(text: string, language: "th-TH" | "en-US"): Promise<boolean> {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setError("อุปกรณ์นี้ไม่มีเสียงอ่านสำรอง");
      return false;
    }
    return await new Promise<boolean>((resolve) => {
      try {
        const current = new SpeechSynthesisUtterance(text);
        current.lang = language;
        current.rate = 1;
        current.voice = window.speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith(language.slice(0, 2))) ?? null;
        utterance.current = current;
        finish.current = resolve;
        current.onstart = () => { setSource("browser"); setLoading(false); setSpeaking(true); };
        current.onend = () => { finish.current = null; stop(); resolve(true); };
        current.onerror = () => { finish.current = null; stop(); setError(language === "th-TH" ? "เบราว์เซอร์เล่นเสียงไทยสำรองไม่สำเร็จ" : "เบราว์เซอร์เล่นเสียงอังกฤษไม่สำเร็จ"); resolve(false); };
        window.speechSynthesis.speak(current);
      } catch {
        finish.current = null;
        stop();
        setError("เบราว์เซอร์เริ่มอ่านเสียงไม่สำเร็จ");
        resolve(false);
      }
    });
  }

  async function speak(text: string): Promise<boolean> {
    if (!enabledRef.current) return true;
    if (!text.trim()) return false;
    stop();
    setError("");
    setSource(null);
    return /[฀-๿]/.test(text) ? speakThai(text) : speakBrowser(text, "en-US");
  }

  function toggle() {
    enabledRef.current = !enabledRef.current;
    setEnabled(enabledRef.current);
    if (!enabledRef.current) stop();
    setError("");
  }

  return { supported, enabled, speaking, loading, error, source, speak, stop, toggle, prepare };
}
