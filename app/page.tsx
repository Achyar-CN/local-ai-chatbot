"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertTriangle, X, ShieldCheck, Database, Globe, Sparkle } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Composer } from "@/components/Composer";
import { MessageBubble, ThinkingBubble } from "@/components/MessageBubble";
import { SourceViewer } from "@/components/SourceViewer";
import { Brandmark } from "@/components/Brandmark";
import { config, DEFAULT_CHAT_MODEL } from "@/lib/config";
import type { DocumentMeta, ConversationMeta, Source } from "@/lib/types";
import type { UIMessage } from "ai";

const SUGGESTIONS = [
  "Summarize the documents I uploaded",
  "What are the key takeaways from this file?",
  "Explain the core concepts in simple terms",
];

function messageText(m: UIMessage): string {
  return (m.parts as { type: string; text?: string }[])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

function messagesToMarkdown(messages: UIMessage[]): string {
  const lines = [`# Conversation`, "", `_${new Date().toLocaleString("en-US")}_`, ""];
  for (const m of messages) {
    const who = m.role === "user" ? "You" : "Atlas";
    lines.push(`## ${who}`, "", messageText(m) || "_(no text)_", "");
  }
  return lines.join("\n");
}

export default function Home() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_CHAT_MODEL);
  const [ragOn, setRagOn] = useState(true);
  const [webOn, setWebOn] = useState(true);
  const [rerankOn, setRerankOn] = useState(true);
  const [guardOn, setGuardOn] = useState(true);
  const [topK, setTopK] = useState<number>(config.topK);

  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [convId, setConvId] = useState<string>(() => crypto.randomUUID());
  const [viewerSource, setViewerSource] = useState<Source | null>(null);

  const [uploading, setUploading] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<string>("");
  const titledRef = useRef<Set<string>>(new Set());

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  // --- data loading -------------------------------------------------------
  const refreshDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      setDocuments((await res.json()).documents ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      setConversations((await res.json()).conversations ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshDocs();
    refreshConversations();
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setOllamaOnline(d.online))
      .catch(() => setOllamaOnline(false));
  }, [refreshDocs, refreshConversations]);

  // --- persist conversation on completion ---------------------------------
  useEffect(() => {
    if (status !== "ready" || messages.length === 0) return;
    if (messages[messages.length - 1].role !== "assistant") return;
    const sig = `${convId}:${messages.length}`;
    if (savedRef.current === sig) return;
    savedRef.current = sig;

    const id = convId;
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, messages }),
    })
      .then(async () => {
        // Auto-title once, after the first full exchange.
        if (!titledRef.current.has(id) && messages.length >= 2) {
          titledRef.current.add(id);
          const firstUser = messages.find((m) => m.role === "user");
          const text = firstUser ? messageText(firstUser) : "";
          if (text) {
            const r = await fetch("/api/title", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            }).then((res) => res.json());
            if (r.title) {
              await fetch(`/api/conversations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: r.title }),
              });
            }
          }
        }
        refreshConversations();
      })
      .catch(() => {});
  }, [status, messages, convId, refreshConversations]);

  // --- autoscroll ---------------------------------------------------------
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // --- actions ------------------------------------------------------------
  const send = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    setInput("");
    sendMessage(
      { text: value },
      { body: { useRag: ragOn, web: webOn, rerank: rerankOn, guard: guardOn, model, topK } },
    );
  };

  const handleExport = () => {
    if (messages.length === 0) return;
    const md = messagesToMarkdown(messages);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (files: FileList | File[]) => {
    setUploading(true);
    setBanner(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      await refreshDocs();
      if (!ragOn) setRagOn(true);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    await fetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    refreshDocs();
  };

  const newChat = useCallback(() => {
    stop();
    setConvId(crypto.randomUUID());
    setMessages([]);
    savedRef.current = "";
  }, [stop, setMessages]);

  const selectConversation = async (id: string) => {
    if (id === convId) return;
    stop();
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (data.conversation) {
        setConvId(id);
        setMessages(data.conversation.messages ?? []);
        savedRef.current = `${id}:${data.conversation.messages?.length ?? 0}`;
      }
    } catch {
      setBanner("Couldn't load that conversation.");
    }
  };

  const deleteConversation = async (id: string) => {
    setConversations((cs) => cs.filter((c) => c.id !== id));
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (id === convId) newChat();
    refreshConversations();
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <Sidebar
        conversations={conversations}
        currentId={convId}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onNewChat={newChat}
        documents={documents}
        uploading={uploading}
        onUpload={handleUpload}
        onDeleteDocument={handleDeleteDocument}
        model={model}
        setModel={setModel}
        ragOn={ragOn}
        setRagOn={setRagOn}
        webOn={webOn}
        setWebOn={setWebOn}
        rerankOn={rerankOn}
        setRerankOn={setRerankOn}
        guardOn={guardOn}
        setGuardOn={setGuardOn}
        topK={topK}
        setTopK={setTopK}
        onExport={handleExport}
        canExport={messages.length > 0}
        ollamaOnline={ollamaOnline}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={
            conversations.find((c) => c.id === convId)?.title ??
            (messages.length > 0 ? "Conversation" : "New conversation")
          }
          ragOn={ragOn}
          webOn={webOn}
          guardOn={guardOn}
        />
        {ollamaOnline === false && (
          <Banner tone="warn">
            Ollama not detected. Run <code className="font-mono">ollama serve</code>, then reload.
          </Banner>
        )}
        {(banner || error) && (
          <Banner tone="error" onClose={() => setBanner(null)}>
            {banner ?? "Something went wrong reaching the model."}
          </Banner>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.length === 0 ? (
              <EmptyState onPick={send} hasDocs={documents.length > 0} guardOn={guardOn} />
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} onOpenSource={setViewerSource} />
                ))}
                {status === "submitted" && <ThinkingBubble />}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border bg-bg/80 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl px-4 py-4">
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={() => send(input)}
              onStop={stop}
              busy={busy}
              ragOn={ragOn}
            />
          </div>
        </div>
      </main>

      <SourceViewer source={viewerSource} onClose={() => setViewerSource(null)} />
    </div>
  );
}

function Banner({
  tone,
  children,
  onClose,
}: {
  tone: "warn" | "error";
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-xs ${
        tone === "warn" ? "bg-amber-500/10 text-amber-300" : "bg-destructive/10 text-red-300"
      }`}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">{children}</span>
      {onClose && (
        <button onClick={onClose} className="cursor-pointer hover:opacity-70" aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function TopBar({
  title,
  ragOn,
  webOn,
  guardOn,
}: {
  title: string;
  ragOn: boolean;
  webOn: boolean;
  guardOn: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
      <h2 className="min-w-0 truncate text-sm font-medium text-foreground">{title}</h2>
      <div className="flex shrink-0 items-center gap-1.5">
        {ragOn && <ModeChip icon={<Database className="h-3 w-3" />}>RAG</ModeChip>}
        {webOn && <ModeChip icon={<Globe className="h-3 w-3" />}>Web</ModeChip>}
        {guardOn && <ModeChip icon={<ShieldCheck className="h-3 w-3" />}>Guard</ModeChip>}
      </div>
    </header>
  );
}

function ModeChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-accent/25 bg-accent-soft/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
      {icon}
      {children}
    </span>
  );
}

function EmptyState({
  onPick,
  hasDocs,
  guardOn,
}: {
  onPick: (text: string) => void;
  hasDocs: boolean;
  guardOn: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 -z-10 rounded-full bg-accent/20 blur-2xl" />
        <div className="grid h-16 w-16 place-items-center rounded-[1.4rem] bg-accent text-accent-fg glow-accent">
          <Brandmark className="h-9 w-9" />
        </div>
      </div>
      <p className="label-mono mb-3">Private · Offline · Yours</p>
      <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em]">
        Ask your knowledge,
        <br />
        not the cloud.
      </h2>
      <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted">
        Runs fully on your machine. Add documents, then ask. Every answer cites its source.
      </p>
      {guardOn && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft/30 px-3 py-1 text-xs text-accent">
          <ShieldCheck className="h-3.5 w-3.5" /> Safety guardrail active
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {(hasDocs
          ? SUGGESTIONS
          : ["What can you do?", "Explain RAG in one paragraph", "Write a haiku about offline AI"]
        ).map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="press group flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3.5 py-2 text-xs text-muted hover:border-accent/50 hover:text-foreground cursor-pointer"
          >
            <Sparkle className="h-3 w-3 text-faint transition-colors group-hover:text-accent" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
