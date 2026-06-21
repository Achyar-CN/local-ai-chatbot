"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";

type WinSR = Window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

export function speechInputSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as WinSR;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function speechOutputSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Microphone dictation via the Web Speech API. Calls onFinal with the transcript. */
export function useDictation(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const start = useCallback(() => {
    const w = window as WinSR;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ")
        .trim();
      if (text) onFinal(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [onFinal]);

  const stop = useCallback(() => {
    recRef.current?.stop?.();
    setListening(false);
  }, []);

  useEffect(() => () => recRef.current?.abort?.(), []);

  return { listening, start, stop };
}

export function speak(text: string): void {
  if (!speechOutputSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.03;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (speechOutputSupported()) window.speechSynthesis.cancel();
}
