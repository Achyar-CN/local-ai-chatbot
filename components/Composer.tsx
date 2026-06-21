"use client";

import { useRef, useEffect, type FormEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "./ui/button";
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
          "flex items-end gap-2 rounded-2xl border bg-surface p-2 pl-4 transition-colors",
          "border-border focus-within:border-accent/50",
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
          placeholder={
            ragOn ? "Tanya apa saja tentang dokumen Anda…" : "Tulis pesan…"
          }
          className="max-h-[200px] flex-1 resize-none self-center bg-transparent py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-faint"
        />
        {busy ? (
          <Button type="button" variant="soft" size="icon" onClick={onStop} aria-label="Hentikan">
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            size="icon"
            disabled={!value.trim()}
            aria-label="Kirim"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 px-1 text-center text-[11px] text-faint">
        {ragOn ? "Mode dokumen aktif — jawaban dirujuk dari file Anda." : "Mode chat biasa."}{" "}
        Enter kirim · Shift+Enter baris baru
      </p>
    </form>
  );
}
