"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, AlertTriangle, X, ShieldCheck } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Composer } from "@/components/Composer";
import { MessageBubble, ThinkingBubble } from "@/components/MessageBubble";
import { config } from "@/lib/config";
import type { DocumentMeta, ConversationMeta } from "@/lib/types";

const SUGGESTIONS = [
  "Ringkas dokumen yang saya unggah",
  "Apa poin-poin penting dari file ini?",
  "Jelaskan konsep utama secara sederhana",
];

export default function Home() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(config.chatModel);
  const [ragOn, setRagOn] = useState(true);
  const [guardOn, setGuardOn] = useState(true);
  const [topK, setTopK] = useState<number>(config.topK);

  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [convId, setConvId] = useState<string>(() => crypto.randomUUID());

  const [uploading, setUploading] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<string>("");

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
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: convId, messages }),
    })
      .then(refreshConversations)
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
    sendMessage({ text: value }, { body: { useRag: ragOn, guard: guardOn, model, topK } });
  };

  const handleUpload = async (files: FileList | File[]) => {
    setUploading(true);
    setBanner(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload gagal.");
      await refreshDocs();
      if (!ragOn) setRagOn(true);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Upload gagal.");
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
      setBanner("Gagal memuat percakapan.");
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
        guardOn={guardOn}
        setGuardOn={setGuardOn}
        topK={topK}
        setTopK={setTopK}
        ollamaOnline={ollamaOnline}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {ollamaOnline === false && (
          <Banner tone="warn">
            Ollama tidak terdeteksi. Jalankan <code className="font-mono">ollama serve</code> lalu
            muat ulang.
          </Banner>
        )}
        {(banner || error) && (
          <Banner tone="error" onClose={() => setBanner(null)}>
            {banner ?? "Terjadi kesalahan saat menghubungi model."}
          </Banner>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.length === 0 ? (
              <EmptyState onPick={send} hasDocs={documents.length > 0} guardOn={guardOn} />
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
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
        <button onClick={onClose} className="cursor-pointer hover:opacity-70" aria-label="Tutup">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-[0_12px_40px_-12px_rgba(34,197,94,0.7)]">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">Asisten AI Lokal Anda</h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        Berjalan sepenuhnya di laptop Anda lewat Ollama. Unggah dokumen di sebelah kiri, lalu
        tanyakan apa pun — jawaban dirujuk langsung ke sumbernya.
      </p>
      {guardOn && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-accent">
          <ShieldCheck className="h-3.5 w-3.5" /> Guardrail keamanan aktif
        </p>
      )}
      {hasDocs && (
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
