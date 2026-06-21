import { generateText } from "ai";
import { ollama } from "../ollama";
import { config } from "../config";

/**
 * Multi-query expansion: rewrite the question into a few diverse search queries
 * so retrieval catches phrasings the original misses. Returns the original plus
 * up to three variants. Falls back to the original on any failure.
 */
export async function expandQuery(query: string): Promise<string[]> {
  const q = query.trim();
  if (q.length < 8) return [q];
  try {
    const { text } = await generateText({
      model: ollama(config.chatModelFast),
      temperature: 0.3,
      maxOutputTokens: 120,
      system:
        "Rewrite the question into 3 short, diverse search queries with the same intent. One query per line. No numbering, no quotes, no extra text. Keep the user's language.",
      prompt: q,
    });
    const variants = text
      .split("\n")
      .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((s) => s.length > 2);
    return [...new Set([q, ...variants])].slice(0, 4);
  } catch {
    return [q];
  }
}
