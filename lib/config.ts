/** Centralized env-driven config (server-side). */
export const config = {
  ollamaBaseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/api",
  chatModel: process.env.CHAT_MODEL ?? "qwen2.5:7b-instruct",
  chatModelFast: process.env.CHAT_MODEL_FAST ?? "llama3.2:3b",
  guardModel: process.env.GUARD_MODEL ?? "llama-guard3:1b",
  embedModel: process.env.EMBED_MODEL ?? "nomic-embed-text",
  embedDim: Number(process.env.EMBED_DIM ?? 768),
  topK: Number(process.env.RAG_TOP_K ?? 4),
  chunkSize: Number(process.env.RAG_CHUNK_SIZE ?? 900),
  chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP ?? 120),
  lancedbPath: process.env.LANCEDB_PATH ?? "./.lancedb",
  // Keep models resident in Ollama between requests for a faster first token.
  keepAlive: process.env.OLLAMA_KEEP_ALIVE ?? "30m",
  // Cap conversation history sent to the model (characters) to stay fast.
  historyBudget: Number(process.env.HISTORY_BUDGET ?? 8000),
  // Optional self-hosted SearXNG for the most reliable keyless web search.
  searxngUrl: process.env.SEARXNG_URL ?? "",
  // Llama Guard categories that actually block. Serious-harm only by default,
  // so benign questions (advice S6, privacy S7, defamation S5, IP S8, elections S13)
  // are not falsely refused.
  guardBlock: (process.env.GUARD_BLOCK ?? "S1,S2,S3,S4,S9,S10,S11,S12,S14")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
} as const;

/** Default chat model shown in the UI. */
export const DEFAULT_CHAT_MODEL = config.chatModelFast;

/** Models selectable from the UI (default first). */
export const CHAT_MODELS = [
  { id: config.chatModelFast, label: "Llama 3.2 3B", hint: "Fast and light" },
  { id: config.chatModel, label: "Qwen2.5 7B", hint: "Slower, best quality" },
] as const;
