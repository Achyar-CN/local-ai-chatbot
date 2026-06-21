"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Plus,
  Loader2,
  Database,
  Circle,
  ShieldCheck,
  MessageSquare,
  Library,
  Globe,
  ListFilter,
  Download,
  Search,
  Sparkles,
  Route,
  Wrench,
  Lock,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "./ui/button";
import { Brandmark, Wordmark } from "./Brandmark";
import { CHAT_MODELS } from "@/lib/config";
import { isLockEnabled, setPin, removePin, lockNow } from "@/lib/lock";
import type { DocumentMeta, ConversationMeta } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

interface SidebarProps {
  conversations: ConversationMeta[];
  currentId: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewChat: () => void;
  documents: DocumentMeta[];
  uploading: boolean;
  onUpload: (files: FileList | File[]) => void;
  onDeleteDocument: (id: string) => void;
  model: string;
  setModel: (m: string) => void;
  ragOn: boolean;
  setRagOn: (v: boolean) => void;
  webOn: boolean;
  setWebOn: (v: boolean) => void;
  rerankOn: boolean;
  setRerankOn: (v: boolean) => void;
  expandOn: boolean;
  setExpandOn: (v: boolean) => void;
  smartRoute: boolean;
  setSmartRoute: (v: boolean) => void;
  toolsOn: boolean;
  setToolsOn: (v: boolean) => void;
  guardOn: boolean;
  setGuardOn: (v: boolean) => void;
  topK: number;
  setTopK: (v: number) => void;
  activeDocIds: string[];
  onToggleDoc: (id: string) => void;
  onExport: () => void;
  canExport: boolean;
  onLockNow: () => void;
  ollamaOnline: boolean | null;
}

interface SearchHit {
  id: string;
  title: string;
  snippet: string;
}

type Tab = "chats" | "docs";

export function Sidebar(props: SidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<Tab>("chats");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        setResults((await r.json()).hits ?? []);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) {
      props.onUpload(e.dataTransfer.files);
      setTab("docs");
    }
  };

  const chunkCount = props.documents.reduce((s, d) => s + d.chunks, 0);

  return (
    <aside className="flex h-full w-[324px] shrink-0 flex-col border-r border-border bg-surface/50 backdrop-blur-sm">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-5">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-accent-fg glow-accent">
          <Brandmark className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <Wordmark className="block text-[15px] font-semibold leading-tight" />
          <p className="label-mono mt-0.5">Local knowledge engine</p>
        </div>
      </div>

      <div className="px-3 pt-1">
        <Button variant="primary" className="press w-full" onClick={props.onNewChat}>
          <Plus className="h-4 w-4" /> New chat
        </Button>
      </div>

      {/* Tabs */}
      <div className="mt-4 px-3">
        <div className="flex rounded-xl border border-border bg-bg/50 p-1 text-xs font-medium">
          <TabButton active={tab === "chats"} onClick={() => setTab("chats")}>
            <MessageSquare className="h-3.5 w-3.5" /> History
          </TabButton>
          <TabButton active={tab === "docs"} onClick={() => setTab("docs")}>
            <Library className="h-3.5 w-3.5" /> Library
            {props.documents.length > 0 && (
              <span className="ml-0.5 rounded bg-accent-soft px-1 font-mono text-[10px] text-accent">
                {props.documents.length}
              </span>
            )}
          </TabButton>
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-3 flex-1 overflow-y-auto px-3">
        {tab === "chats" ? (
          <>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations"
                className="w-full rounded-lg border border-border bg-bg/50 py-1.5 pl-8 pr-2 text-xs text-foreground outline-none placeholder:text-faint focus:border-accent/50"
              />
            </div>
            {results !== null ? (
              <SearchResults hits={results} onSelect={props.onSelectConversation} />
            ) : (
              <ConversationList {...props} />
            )}
          </>
        ) : (
          <DocsPanel
            {...props}
            dragging={dragging}
            setDragging={setDragging}
            handleDrop={handleDrop}
            inputRef={inputRef}
          />
        )}
      </div>

      {/* Settings */}
      <div className="space-y-3 border-t border-border p-3">
        <p className="label-mono px-1">Retrieval</p>
        <Toggle
          label="Documents (RAG)"
          icon={<Database className="h-3.5 w-3.5 text-muted" />}
          checked={props.ragOn}
          onChange={props.setRagOn}
        />
        <Toggle
          label="Web search"
          icon={<Globe className="h-3.5 w-3.5 text-muted" />}
          checked={props.webOn}
          onChange={props.setWebOn}
        />
        <Toggle
          label="Smart routing"
          icon={<Route className="h-3.5 w-3.5 text-muted" />}
          checked={props.smartRoute}
          onChange={props.setSmartRoute}
        />
        {props.ragOn && (
          <>
            <Toggle
              label="Query expansion"
              icon={<Sparkles className="h-3.5 w-3.5 text-muted" />}
              checked={props.expandOn}
              onChange={props.setExpandOn}
            />
            <Toggle
              label="Hybrid rerank"
              icon={<ListFilter className="h-3.5 w-3.5 text-muted" />}
              checked={props.rerankOn}
              onChange={props.setRerankOn}
            />
            <div className="pt-0.5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-muted">Chunks retrieved</span>
                <span className="rounded bg-elevated px-1.5 font-mono text-[11px] tabular-nums text-accent">
                  {props.topK}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={props.topK}
                onChange={(e) => props.setTopK(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-elevated accent-accent"
              />
            </div>
          </>
        )}

        <p className="label-mono px-1 pt-1.5">Engine</p>
        <Toggle
          label="Tools (math, web fetch)"
          icon={<Wrench className="h-3.5 w-3.5 text-muted" />}
          checked={props.toolsOn}
          onChange={props.setToolsOn}
        />
        <Toggle
          label="Safety guardrail"
          icon={<ShieldCheck className="h-3.5 w-3.5 text-muted" />}
          checked={props.guardOn}
          onChange={props.setGuardOn}
        />
        <div className="relative">
          <select
            value={props.model}
            onChange={(e) => props.setModel(e.target.value)}
            className="press w-full cursor-pointer appearance-none rounded-lg border border-border bg-elevated px-2.5 py-2 text-xs text-foreground outline-none focus:border-accent/50"
          >
            {CHAT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.hint}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={props.onExport}
          disabled={!props.canExport}
          className="press flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-elevated py-2 text-xs font-medium text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 enabled:cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" /> Export chat
        </button>

        <LockControl onLockNow={props.onLockNow} />

        <div className="flex items-center justify-between px-1 pt-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
          <span className="flex items-center gap-1.5">
            <Circle
              className={cn(
                "h-2 w-2 fill-current",
                props.ollamaOnline === null
                  ? "text-faint"
                  : props.ollamaOnline
                    ? "text-accent pulse-ring rounded-full"
                    : "text-destructive",
              )}
            />
            Ollama {props.ollamaOnline === false ? "offline" : "online"}
          </span>
          <span>{chunkCount} chunks</span>
        </div>
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition-colors cursor-pointer",
        active ? "bg-elevated text-foreground shadow-sm" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ConversationList(props: SidebarProps) {
  if (props.conversations.length === 0) {
    return (
      <div className="px-2 py-8 text-center text-xs leading-relaxed text-faint">
        No conversations yet.
        <br />
        Start chatting and they save automatically.
      </div>
    );
  }
  return (
    <ul className="space-y-0.5">
      {props.conversations.map((c) => {
        const active = c.id === props.currentId;
        return (
          <li
            key={c.id}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors cursor-pointer",
              active ? "bg-accent-soft/50" : "hover:bg-foreground/[0.03]",
            )}
            onClick={() => props.onSelectConversation(c.id)}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
            )}
            <MessageSquare
              className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-faint")}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{c.title}</p>
              <p className="font-mono text-[10px] text-faint">{c.messageCount} messages</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onDeleteConversation(c.id);
              }}
              aria-label="Delete conversation"
              className="shrink-0 rounded-md p-1 text-faint opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DocsPanel(
  props: SidebarProps & {
    dragging: boolean;
    setDragging: (v: boolean) => void;
    handleDrop: (e: DragEvent) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
  },
) {
  return (
    <div>
      <button
        onClick={() => props.inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          props.setDragging(true);
        }}
        onDragLeave={() => props.setDragging(false)}
        onDrop={props.handleDrop}
        disabled={props.uploading}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed px-3 py-6 text-center transition-colors cursor-pointer",
          props.dragging
            ? "border-accent bg-accent-soft/40"
            : "border-border hover:border-accent/50 hover:bg-foreground/[0.02]",
          props.uploading && "pointer-events-none opacity-60",
        )}
      >
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl transition-colors",
            props.dragging ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
          )}
        >
          {props.uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </span>
        <span className="text-xs font-medium text-foreground">
          {props.uploading ? "Indexing…" : "Drop files or click to upload"}
        </span>
        <span className="label-mono">PDF · DOCX · IMG · TXT · MD</span>
      </button>
      <input
        ref={props.inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) props.onUpload(e.target.files);
          e.target.value = "";
        }}
      />

      {props.documents.length === 0 ? (
        <div className="px-2 py-8 text-center text-xs text-faint">Your library is empty.</div>
      ) : (
        <>
          <p className="mb-1 mt-3 px-1 font-mono text-[10px] uppercase tracking-wider text-faint">
            {props.activeDocIds.length === 0
              ? "Using all documents"
              : `Scoped to ${props.activeDocIds.length}`}
          </p>
          <ul className="space-y-0.5">
            {props.documents.map((doc) => {
              const scoped = props.activeDocIds.includes(doc.id);
              return (
                <li
                  key={doc.id}
                  className="group flex items-center gap-2 rounded-lg px-1.5 py-2 transition-colors hover:bg-foreground/[0.03]"
                >
                  <button
                    onClick={() => props.onToggleDoc(doc.id)}
                    aria-label={scoped ? "Remove from scope" : "Add to scope"}
                    className="shrink-0 text-faint hover:text-accent cursor-pointer"
                  >
                    {scoped ? (
                      <CheckSquare className="h-4 w-4 text-accent" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft/60 text-accent">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{doc.name}</p>
                    <p className="font-mono text-[10px] text-faint">
                      {doc.chunks} chunks · {formatBytes(doc.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => props.onDeleteDocument(doc.id)}
                    aria-label={`Delete ${doc.name}`}
                    className="shrink-0 rounded-md p-1 text-faint opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Toggle({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="flex items-center gap-2 text-xs font-medium text-foreground">
        {icon} {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer",
          checked ? "bg-accent" : "bg-elevated",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </label>
  );
}

function SearchResults({
  hits,
  onSelect,
}: {
  hits: SearchHit[];
  onSelect: (id: string) => void;
}) {
  if (hits.length === 0) {
    return <div className="px-2 py-8 text-center text-xs text-faint">No matches.</div>;
  }
  return (
    <ul className="space-y-1">
      {hits.map((h) => (
        <li key={h.id}>
          <button
            onClick={() => onSelect(h.id)}
            className="w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.03] cursor-pointer"
          >
            <p className="truncate text-xs font-medium text-foreground">{h.title}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-faint">{h.snippet}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

function LockControl({ onLockNow }: { onLockNow: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pin, setPinValue] = useState("");
  useEffect(() => setEnabled(isLockEnabled()), []);

  const save = async () => {
    if (pin.trim().length < 4) return;
    if (enabled) {
      if (await removePin(pin.trim())) {
        setEnabled(false);
        setEditing(false);
        setPinValue("");
      }
    } else {
      await setPin(pin.trim());
      setEnabled(true);
      setEditing(false);
      setPinValue("");
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <button
          onClick={() => setEditing((v) => !v)}
          className="press flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-elevated py-2 text-xs font-medium text-muted hover:text-foreground cursor-pointer"
        >
          <Lock className="h-3.5 w-3.5" /> {enabled ? "Change PIN" : "Set PIN"}
        </button>
        {enabled && (
          <button
            onClick={onLockNow}
            className="press rounded-lg border border-border bg-elevated px-3 py-2 text-xs font-medium text-muted hover:text-foreground cursor-pointer"
          >
            Lock now
          </button>
        )}
      </div>
      {editing && (
        <div className="flex gap-1.5">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPinValue(e.target.value)}
            placeholder={enabled ? "Current PIN to remove" : "New PIN (min 4)"}
            className="w-full rounded-lg border border-border bg-bg/50 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent/50"
          />
          <button
            onClick={save}
            className="press rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg cursor-pointer"
          >
            {enabled ? "Remove" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
