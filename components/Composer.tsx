"use client";

import { useRef, useEffect, useState, type FormEvent } from "react";
import { ArrowUp, Square, Mic } from "lucide-react";
import { Button } from "./ui/button";
import { useDictation, speechInputSupported } from "@/lib/voice";
import { cn } from "@/lib/utils";

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  ragOn: boolean;
}

export function Composer({ value, onChange, onSubmit, onStop, busy, ragOn }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [micOk, setMicOk] = useState(false);
  useEffect(() => setMicOk(speechInputSupported()), []);
  const { listening, start, stop } = useDictation((text) =>
    onChange(value ? `${value} ${text}` : text),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || !value.trim()) return;
    onSubmit();
  };

  return (
    <form onSubmit={submit} className="relative">
      <div
        className={cn(
          "flex items-end gap-2 rounded-[1.25rem] border bg-surface/80 p-2 pl-4 backdrop-blur",
          "press border-border focus-within:border-accent/60 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-accent)_12%,transparent)]",
        )}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={ragOn ? "Ask anything about your documents…" : "Send a message…"}
          className="max-h-[200px] flex-1 resize-none self-center bg-transparent py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-faint"
        />
        {micOk && !busy && (
          <Button
            type="button"
            variant={listening ? "primary" : "soft"}
            size="icon"
            onClick={() => (listening ? stop() : start())}
            aria-label={listening ? "Stop dictation" : "Dictate"}
            className={cn(listening && "pulse-ring")}
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}
        {busy ? (
          <Button type="button" variant="soft" size="icon" onClick={onStop} aria-label="Stop">
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            size="icon"
            disabled={!value.trim()}
            aria-label="Send"
            className={cn(value.trim() && "glow-accent")}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 px-1 text-center text-[11px] text-faint">
        <Kbd>Enter</Kbd> to send
        <span className="text-border">·</span>
        <Kbd>Shift</Kbd>
        <Kbd>Enter</Kbd> for new line
      </p>
    </form>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-elevated px-1.5 py-px font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}
