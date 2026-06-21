"use client";

import { useState } from "react";
import { FileText, Globe, ChevronDown, ExternalLink } from "lucide-react";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Sources({
  sources,
  onOpen,
}: {
  sources: Source[];
  onOpen: (s: Source) => void;
}) {
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
        {sources.length} {sources.length === 1 ? "source" : "sources"} cited
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul className="mt-2 space-y-2 animate-fade-up">
          {sources.map((s) => {
            const isWeb = s.kind === "web";
            return (
              <li key={s.n}>
                <button
                  onClick={() => onOpen(s)}
                  className="w-full rounded-lg border border-border bg-bg/50 p-2.5 text-left text-xs transition-colors hover:border-accent/50 hover:bg-accent-soft/20 cursor-pointer"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-muted">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent-soft text-[10px] font-semibold text-accent">
                        {s.n}
                      </span>
                      {isWeb ? (
                        <Globe className="h-3 w-3 shrink-0 text-faint" />
                      ) : (
                        <FileText className="h-3 w-3 shrink-0 text-faint" />
                      )}
                      <span className="truncate">{s.docName}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 tabular-nums">
                      {isWeb ? (
                        <ExternalLink className="h-3 w-3" />
                      ) : (
                        <>hal. {s.page} · {(s.score * 100).toFixed(0)}%</>
                      )}
                    </span>
                  </div>
                  <p className="line-clamp-2 leading-relaxed text-muted">
                    {isWeb && s.url ? `${new URL(s.url).hostname} · ` : ""}
                    {s.text}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
