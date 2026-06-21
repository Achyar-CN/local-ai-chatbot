"use client";

import type { UIMessage } from "ai";
import { User, ShieldAlert } from "lucide-react";
import { Markdown } from "./Markdown";
import { Sources } from "./Sources";
import { Brandmark } from "./Brandmark";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

type AnyPart = { type: string; text?: string; data?: unknown };
interface GuardData {
  safe: boolean;
  categories: string[];
  via: string;
}

function extractText(message: UIMessage): string {
  return (message.parts as AnyPart[])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

function extractSources(message: UIMessage): Source[] {
  const part = (message.parts as AnyPart[]).find((p) => p.type === "data-sources");
  return part ? ((part.data as Source[]) ?? []) : [];
}

function extractGuard(message: UIMessage): GuardData | null {
  const part = (message.parts as AnyPart[]).find((p) => p.type === "data-guardrail");
  return part ? (part.data as GuardData) : null;
}

export function MessageBubble({
  message,
  onOpenSource,
}: {
  message: UIMessage;
  onOpenSource: (s: Source) => void;
}) {
  const isUser = message.role === "user";
  const text = extractText(message);
  const sources = extractSources(message);
  const guard = extractGuard(message);
  const blocked = guard && !guard.safe;

  return (
    <div className={cn("flex gap-3 animate-fade-up", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
          isUser
            ? "border-border bg-user text-muted"
            : blocked
              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
              : "border-accent/30 bg-accent-soft text-accent",
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : blocked ? (
          <ShieldAlert className="h-4 w-4" />
        ) : (
          <Brandmark className="h-4 w-4" />
        )}
      </div>

      <div className={cn("min-w-0 max-w-[min(48rem,85%)]", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "rounded-tr-sm bg-user text-foreground"
              : blocked
                ? "rounded-tl-sm border border-amber-500/25 bg-amber-500/[0.06]"
                : "rounded-tl-sm border border-border bg-surface",
          )}
        >
          {blocked && (
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-400">
              <ShieldAlert className="h-3.5 w-3.5" /> Blocked by guardrail
            </div>
          )}
          {text ? <Markdown>{text}</Markdown> : <span className="text-sm text-muted">…</span>}
          {!isUser && !blocked && <Sources sources={sources} onOpen={onOpenSource} />}
        </div>
      </div>
    </div>
  );
}

export function ThinkingBubble() {
  return (
    <div className="flex gap-3 animate-fade-up">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
        <Brandmark className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-4">
        <span className="typing-dot" style={{ animationDelay: "0ms" }} />
        <span className="typing-dot" style={{ animationDelay: "150ms" }} />
        <span className="typing-dot" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
