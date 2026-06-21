import { embedQuery } from "./embeddings";
import { searchChunks } from "./vectorstore";
import { listDocuments } from "./vectorstore";
import { rerank } from "./rerank";
import { config } from "../config";
import type { Source } from "../types";
import type { WebResult } from "../websearch";

export type { Source };

/** Retrieve doc chunks for a query, optionally hybrid-reranked. n is assigned later. */
export async function retrieve(
  query: string,
  k = config.topK,
  useRerank = true,
): Promise<Source[]> {
  const vector = await embedQuery(query);
  // Over-fetch when reranking so the lexical pass has candidates to promote.
  const fetchK = useRerank ? Math.min(k * 5, 40) : k;
  let hits = await searchChunks(vector, fetchK);
  if (useRerank) hits = rerank(query, hits, k);
  else hits = hits.slice(0, k);

  const docs = await listDocuments();
  const extById = new Map(docs.map((d) => [d.id, d.ext]));

  return hits.map((h) => ({
    n: 0,
    kind: "doc" as const,
    docName: h.docName,
    docId: h.docId,
    page: h.page,
    ext: extById.get(h.docId),
    text: h.text,
    score: Number(h.score.toFixed(3)),
  }));
}

/** Shape web search results into citable sources. */
export function webToSources(results: WebResult[]): Source[] {
  return results.map((r) => ({
    n: 0,
    kind: "web" as const,
    docName: r.title,
    url: r.url,
    text: r.text || r.snippet,
    score: 0,
  }));
}

/** Concatenate sources and assign stable [n] numbers. */
export function numberSources(...groups: Source[][]): Source[] {
  return groups.flat().map((s, i) => ({ ...s, n: i + 1 }));
}

/** Build the grounded system prompt fed to the chat model. */
export function buildSystemPrompt(sources: Source[]): string {
  if (sources.length === 0) {
    return [
      "Kamu adalah asisten AI lokal yang membantu dan akurat.",
      "Tidak ada konteks dokumen/web yang ditemukan untuk pertanyaan ini.",
      "Jawab dari pengetahuan umummu, dan katakan dengan jujur bila tidak yakin.",
    ].join(" ");
  }

  const context = sources
    .map((s) => {
      const head =
        s.kind === "web"
          ? `[${s.n}] (web: ${s.docName} · ${s.url})`
          : `[${s.n}] (${s.docName}, hal. ${s.page})`;
      return `${head}\n${s.text}`;
    })
    .join("\n\n");

  return [
    "Kamu adalah asisten AI lokal yang menjawab berdasarkan KONTEKS di bawah (dari dokumen pengguna dan/atau hasil pencarian web).",
    "Aturan:",
    "- Utamakan informasi dari KONTEKS untuk menjawab.",
    "- Sitasikan sumber memakai penanda [n] sesuai nomor potongan yang kamu pakai.",
    "- Jika KONTEKS tidak memuat jawabannya, katakan demikian dan jangan mengarang.",
    "- Jawab ringkas, jelas, dan dalam bahasa yang sama dengan pertanyaan pengguna.",
    "- Write naturally. Do not use em-dashes (—) or arrows (->); use commas, periods, or parentheses.",
    "",
    "KONTEKS:",
    context,
  ].join("\n");
}
