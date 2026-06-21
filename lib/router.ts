import { generateText } from "ai";
import { ollama } from "./ollama";
import { config } from "./config";

export interface RouteDecision {
  useDocs: boolean;
  useWeb: boolean;
}

/**
 * Per-query router: decide whether a question needs the user's documents, a web
 * search, or neither (answer from the model directly). Only ever enables sources
 * the user has switched on. Falls back to "use whatever is enabled" on failure.
 */
export async function routeQuery(
  query: string,
  opts: { hasDocs: boolean; ragOn: boolean; webOn: boolean },
): Promise<RouteDecision> {
  const fallback = {
    useDocs: opts.ragOn && opts.hasDocs,
    useWeb: opts.webOn,
  };
  if (!opts.ragOn && !opts.webOn) return { useDocs: false, useWeb: false };
  if (query.trim().length < 6) return fallback;

  try {
    const { text } = await generateText({
      model: ollama(config.chatModelFast),
      temperature: 0,
      maxOutputTokens: 12,
      system:
        "Decide which sources are needed to answer the user. Reply with ONLY a comma-separated list using these words: docs, web, none. docs = the user's uploaded documents. web = current or external information. none = general knowledge the assistant already has.",
      prompt: query,
    });
    const t = text.toLowerCase();
    let useDocs = opts.ragOn && opts.hasDocs && t.includes("docs");
    let useWeb = opts.webOn && t.includes("web");
    // If the model gave nothing usable and did not say "none", keep enabled sources.
    if (!useDocs && !useWeb && !t.includes("none")) {
      useDocs = fallback.useDocs;
      useWeb = fallback.useWeb;
    }
    return { useDocs, useWeb };
  } catch {
    return fallback;
  }
}
