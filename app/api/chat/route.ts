import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
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
import { routeQuery } from "@/lib/router";
import { chatTools } from "@/lib/tools";
import { trimHistory } from "@/lib/history";
import { moderate, refusalMessage, type GuardResult } from "@/lib/guardrail";
import { config, CHAT_MODELS } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 180;

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
    expand = true,
    smartRoute = true,
    tools = false,
    guard = false,
    model,
    topK,
    docIds,
    hasDocs = false,
  } = (await req.json()) as {
    messages: UIMessage[];
    useRag?: boolean;
    web?: boolean;
    rerank?: boolean;
    expand?: boolean;
    smartRoute?: boolean;
    tools?: boolean;
    guard?: boolean;
    model?: string;
    topK?: number;
    docIds?: string[];
    hasDocs?: boolean;
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

  // --- Router: decide which enabled sources this query actually needs ------
  let useDocsNow = useRag;
  let useWebNow = web;
  if (query && smartRoute && (useRag || web)) {
    const decision = await routeQuery(query, { hasDocs, ragOn: useRag, webOn: web });
    useDocsNow = decision.useDocs;
    useWebNow = decision.useWeb;
  } else {
    useDocsNow = useRag && hasDocs;
  }

  // --- Retrieval (docs + web in parallel) ---------------------------------
  let docSources: Source[] = [];
  let webSources: Source[] = [];
  if (query && (useDocsNow || useWebNow)) {
    const [docs, webs] = await Promise.all([
      useDocsNow
        ? retrieve(query, k, { useRerank: rerank, expand, docIds }).catch((err) => {
            console.error("RAG retrieval failed:", err);
            return [] as Source[];
          })
        : Promise.resolve([] as Source[]),
      useWebNow
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
  const grounded = sources.length > 0;

  const system = grounded
    ? buildSystemPrompt(sources)
    : "You are a helpful, accurate local AI assistant. Answer clearly in the user's language. Write naturally; do not use em-dashes or arrows.";

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      if (sources.length > 0) {
        writer.write({ type: "data-sources", data: sources });
      }
      const result = streamText({
        model: ollama(chatModel),
        system,
        messages: await convertToModelMessages(trimHistory(messages)),
        temperature: 0.4,
        ...(tools ? { tools: chatTools, stopWhen: stepCountIs(4) } : {}),
      });
      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("Chat stream error:", error);
      return "Could not reach the model. Make sure Ollama is running (ollama serve).";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
