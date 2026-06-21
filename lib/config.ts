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
} as const;

/** Models selectable from the UI. */
export const CHAT_MODELS = [
  { id: config.chatModel, label: "Qwen2.5 7B", hint: "Seimbang · kualitas terbaik" },
  { id: config.chatModelFast, label: "Llama 3.2 3B", hint: "Cepat · ringan" },
] as const;
