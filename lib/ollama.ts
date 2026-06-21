import { createOllama } from "ollama-ai-provider-v2";
import { config } from "./config";

/** Shared Ollama provider pointed at the local runtime. */
export const ollama = createOllama({
  baseURL: config.ollamaBaseURL,
});
