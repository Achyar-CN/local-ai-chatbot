"use client";

import { useEffect } from "react";
import { X, ExternalLink, FileText, Globe } from "lucide-react";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Right-side drawer that shows the original source: PDF page, file, or web link. */
export function SourceViewer({ source, onClose }: { source: Source | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = source !== null;
  const isWeb = source?.kind === "web";
  const isPdf = source?.ext === "pdf";
  const fileUrl = source?.docId ? `/api/files/${source.docId}` : null;
  const pdfUrl = isPdf && fileUrl ? `${fileUrl}#page=${source?.page ?? 1}&view=FitH` : fileUrl;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-dvh w-[min(560px,92vw)] flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {source && (
          <>
            <header className="flex items-start gap-2 border-b border-border px-4 py-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                {isWeb ? <Globe className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{source.docName}</p>
                <p className="text-xs text-muted">
                  {isWeb ? "Sumber web" : `Halaman ${source.page}`}
                  {!isWeb && source.score > 0 && ` · relevansi ${(source.score * 100).toFixed(0)}%`}
                </p>
              </div>
              <a
                href={isWeb ? source.url : (pdfUrl ?? "#")}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground cursor-pointer"
                aria-label="Buka di tab baru"
                title="Buka di tab baru"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                onClick={onClose}
                aria-label="Tutup"
                className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Relevant excerpt */}
            <div className="border-b border-border px-4 py-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                Kutipan relevan
              </p>
              <blockquote className="border-l-2 border-accent/50 bg-accent-soft/30 px-3 py-2 text-xs leading-relaxed text-foreground">
                {source.text}
              </blockquote>
            </div>

            {/* Original content */}
            <div className="min-h-0 flex-1 bg-bg">
              {isWeb ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <Globe className="h-8 w-8 text-faint" />
                  <p className="text-sm text-muted">
                    Halaman web tidak ditampilkan inline (kebijakan keamanan situs).
                  </p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-fg cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Buka {new URL(source.url!).hostname}
                  </a>
                </div>
              ) : fileUrl ? (
                <iframe
                  key={pdfUrl}
                  src={pdfUrl ?? fileUrl}
                  className="h-full w-full"
                  title={`Sumber: ${source.docName}`}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  File asli tidak tersedia.
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
