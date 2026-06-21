import { config } from "../config";

/**
 * Embed text via Ollama's /api/embed endpoint (batch-capable).
 * nomic-embed-text distinguishes search documents vs queries via a prefix,
 * which measurably improves retrieval quality.
 */
async function embed(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const res = await fetch(`${config.ollamaBaseURL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.embedModel, input: inputs }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama embed failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { embeddings: number[][] };
  if (!data.embeddings?.length) throw new Error("Ollama returned no embeddings");
  return data.embeddings;
}

export function embedDocuments(texts: string[]) {
  return embed(texts.map((t) => `search_document: ${t}`));
}

export async function embedQuery(text: string) {
  const [vec] = await embed([`search_query: ${text}`]);
  return vec;
}
