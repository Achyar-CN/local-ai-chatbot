import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { ollama } from "@/lib/ollama";
import {
  retrieve,
  webToSources,
  numberSources,
  buildSystemPrompt,
  type Source,
} from "@/lib/rag/retrieve";
import { webSearch } from "@/lib/websearch";
import { moderate, refusalMessage, type GuardResult } from "@/lib/guardrail";
import { config, CHAT_MODELS } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 120;

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  const {
    messages,
    useRag = true,
    web = false,
    rerank = true,
    guard = false,
    model,
    topK,
  } = (await req.json()) as {
    messages: UIMessage[];
    useRag?: boolean;
    web?: boolean;
    rerank?: boolean;
    guard?: boolean;
    model?: string;
    topK?: number;
  };

  const chatModel = CHAT_MODELS.some((m) => m.id === model) ? model! : config.chatModel;
  const k = topK && topK > 0 && topK <= 10 ? Math.round(topK) : config.topK;
  const query = lastUserText(messages);

  // --- Guardrail: moderate input before doing anything else ---------------
  if (guard && query) {
    let verdict: GuardResult | null = null;
    try {
      verdict = await moderate(query, "user");
    } catch (err) {
      console.error("Guardrail error (allowing):", err);
    }
    if (verdict && !verdict.safe) {
      const refusal = refusalMessage(verdict);
      const blocked = verdict;
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "start" });
          writer.write({ type: "data-guardrail", data: blocked });
          const id = crypto.randomUUID();
          writer.write({ type: "text-start", id });
          writer.write({ type: "text-delta", id, delta: refusal });
          writer.write({ type: "text-end", id });
          writer.write({ type: "finish" });
        },
      });
      return createUIMessageStreamResponse({ stream });
    }
  }

  // --- Retrieval (docs + web, run in parallel) ----------------------------
  let docSources: Source[] = [];
  let webSources: Source[] = [];
  if (query && (useRag || web)) {
    const [docs, webs] = await Promise.all([
      useRag
        ? retrieve(query, k, rerank).catch((err) => {
            console.error("RAG retrieval failed:", err);
            return [] as Source[];
          })
        : Promise.resolve([] as Source[]),
      web
        ? webSearch(query)
            .then(webToSources)
            .catch((err) => {
              console.error("Web search failed:", err);
              return [] as Source[];
            })
        : Promise.resolve([] as Source[]),
    ]);
    docSources = docs;
    webSources = webs;
  }

  const sources = numberSources(docSources, webSources);
  const grounded = useRag || web;

  const system = grounded
    ? buildSystemPrompt(sources)
    : "Kamu adalah asisten AI lokal yang membantu, akurat, dan ramah. Jawab dengan jelas dalam bahasa yang sama dengan pengguna. Write naturally; do not use em-dashes (—) or arrows (->).";

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      if (sources.length > 0) {
        writer.write({ type: "data-sources", data: sources });
      }
      const result = streamText({
        model: ollama(chatModel),
        system,
        messages: await convertToModelMessages(messages),
        temperature: 0.4,
      });
      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("Chat stream error:", error);
      return "Gagal menghubungi model. Pastikan Ollama berjalan (`ollama serve`).";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
