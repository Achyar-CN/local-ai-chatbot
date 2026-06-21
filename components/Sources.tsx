"use client";

import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Sources({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <FileText className="h-3.5 w-3.5 text-accent" />
        {sources.length} sumber dirujuk
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul className="mt-2 space-y-2 animate-fade-up">
          {sources.map((s) => (
            <li
              key={s.n}
              className="rounded-lg border border-border bg-bg/50 p-2.5 text-xs"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-muted">
                <span className="flex items-center gap-1.5 truncate font-medium text-foreground">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent-soft text-[10px] font-semibold text-accent">
                    {s.n}
                  </span>
                  <span className="truncate">{s.docName}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  hal. {s.page} · {(s.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="line-clamp-3 leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
