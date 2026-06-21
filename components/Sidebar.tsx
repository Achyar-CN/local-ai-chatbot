"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Plus,
  Loader2,
  Database,
  Sparkles,
  Circle,
  ShieldCheck,
  MessageSquare,
  Files,
  Globe,
  ListFilter,
  Download,
} from "lucide-react";
import { Button } from "./ui/button";
import { CHAT_MODELS } from "@/lib/config";
import type { DocumentMeta, ConversationMeta } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

interface SidebarProps {
  // conversations
  conversations: ConversationMeta[];
  currentId: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewChat: () => void;
  // documents
  documents: DocumentMeta[];
  uploading: boolean;
  onUpload: (files: FileList | File[]) => void;
  onDeleteDocument: (id: string) => void;
  // settings
  model: string;
  setModel: (m: string) => void;
  ragOn: boolean;
  setRagOn: (v: boolean) => void;
  webOn: boolean;
  setWebOn: (v: boolean) => void;
  rerankOn: boolean;
  setRerankOn: (v: boolean) => void;
  guardOn: boolean;
  setGuardOn: (v: boolean) => void;
  topK: number;
  setTopK: (v: number) => void;
  onExport: () => void;
  canExport: boolean;
  ollamaOnline: boolean | null;
}

type Tab = "chats" | "docs";

export function Sidebar(props: SidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<Tab>("chats");

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) {
      props.onUpload(e.dataTransfer.files);
      setTab("docs");
    }
  };

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-border bg-surface/60 backdrop-blur-sm">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-[0_8px_24px_-8px_rgba(34,197,94,0.6)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight">Local AI Chat</h1>
          <p className="truncate text-xs text-muted">RAG · 100% offline</p>
        </div>
      </div>

      <div className="px-3">
        <Button variant="primary" className="w-full" onClick={props.onNewChat}>
          <Plus className="h-4 w-4" /> Chat baru
        </Button>
      </div>

      {/* Tabs */}
      <div className="mt-3 px-3">
        <div className="flex rounded-lg border border-border bg-bg/40 p-1 text-xs font-medium">
          <TabButton active={tab === "chats"} onClick={() => setTab("chats")}>
            <MessageSquare className="h-3.5 w-3.5" /> Riwayat
          </TabButton>
          <TabButton active={tab === "docs"} onClick={() => setTab("docs")}>
            <Files className="h-3.5 w-3.5" /> Dokumen
            {props.documents.length > 0 && (
              <span className="ml-0.5 rounded bg-accent-soft px-1 text-[10px] text-accent">
                {props.documents.length}
              </span>
            )}
          </TabButton>
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-3 flex-1 overflow-y-auto px-3">
        {tab === "chats" ? (
          <ConversationList {...props} />
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
        <Toggle
          label="Mode dokumen (RAG)"
          icon={<Database className="h-3.5 w-3.5 text-muted" />}
          checked={props.ragOn}
          onChange={props.setRagOn}
        />
        <Toggle
          label="Pencarian web"
          icon={<Globe className="h-3.5 w-3.5 text-muted" />}
          checked={props.webOn}
          onChange={props.setWebOn}
        />
        <Toggle
          label="Guardrail keamanan"
          icon={<ShieldCheck className="h-3.5 w-3.5 text-muted" />}
          checked={props.guardOn}
          onChange={props.setGuardOn}
        />

        {props.ragOn && (
          <>
            <Toggle
              label="Rerank hybrid (akurasi)"
              icon={<ListFilter className="h-3.5 w-3.5 text-muted" />}
              checked={props.rerankOn}
              onChange={props.setRerankOn}
            />
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-muted">Potongan diambil (top-k)</span>
                <span className="tabular-nums text-foreground">{props.topK}</span>
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

        <button
          onClick={props.onExport}
          disabled={!props.canExport}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-elevated py-2 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 enabled:cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" /> Export chat (.md)
        </button>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Model</label>
          <select
            value={props.model}
            onChange={(e) => props.setModel(e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-border bg-elevated px-2.5 py-2 text-xs text-foreground outline-none focus:border-accent/50"
          >
            {CHAT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.hint}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between px-1 text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <Circle
              className={cn(
                "h-2 w-2 fill-current",
                props.ollamaOnline === null
                  ? "text-faint"
                  : props.ollamaOnline
                    ? "text-accent"
                    : "text-destructive",
              )}
            />
            Ollama {props.ollamaOnline === false ? "offline" : "online"}
          </span>
          <span>{props.documents.reduce((s, d) => s + d.chunks, 0)} potongan</span>
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
        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors cursor-pointer",
        active ? "bg-elevated text-foreground" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ConversationList(props: SidebarProps) {
  if (props.conversations.length === 0) {
    return (
      <div className="px-1 py-6 text-center text-xs text-faint">
        Belum ada percakapan.
        <br />
        Mulai chat, otomatis tersimpan.
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {props.conversations.map((c) => (
        <li
          key={c.id}
          className={cn(
            "group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors cursor-pointer",
            c.id === props.currentId ? "bg-accent-soft/60" : "hover:bg-white/[0.03]",
          )}
          onClick={() => props.onSelectConversation(c.id)}
        >
          <MessageSquare
            className={cn(
              "h-4 w-4 shrink-0",
              c.id === props.currentId ? "text-accent" : "text-faint",
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{c.title}</p>
            <p className="text-[11px] text-faint">{c.messageCount} pesan</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onDeleteConversation(c.id);
            }}
            aria-label="Hapus percakapan"
            className="shrink-0 rounded-md p-1 text-faint opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
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
          "flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-3 py-5 text-center transition-colors cursor-pointer",
          props.dragging
            ? "border-accent bg-accent-soft/50"
            : "border-border hover:border-accent/50 hover:bg-white/[0.02]",
          props.uploading && "pointer-events-none opacity-60",
        )}
      >
        {props.uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        ) : (
          <Upload className="h-5 w-5 text-muted" />
        )}
        <span className="text-xs font-medium">
          {props.uploading ? "Memproses…" : "Tarik file atau klik"}
        </span>
        <span className="text-[11px] text-faint">PDF · DOCX · TXT · MD</span>
      </button>
      <input
        ref={props.inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.csv,.json"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) props.onUpload(e.target.files);
          e.target.value = "";
        }}
      />

      {props.documents.length === 0 ? (
        <div className="px-1 py-6 text-center text-xs text-faint">Belum ada dokumen.</div>
      ) : (
        <ul className="mt-3 space-y-1">
          {props.documents.map((doc) => (
            <li
              key={doc.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.03]"
            >
              <FileText className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{doc.name}</p>
                <p className="text-[11px] text-faint">
                  {doc.chunks} potongan · {formatBytes(doc.size)}
                </p>
              </div>
              <button
                onClick={() => props.onDeleteDocument(doc.id)}
                aria-label={`Hapus ${doc.name}`}
                className="shrink-0 rounded-md p-1 text-faint opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
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
    <label className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-xs font-medium">
        {icon} {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors cursor-pointer",
          checked ? "bg-accent" : "bg-elevated",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
