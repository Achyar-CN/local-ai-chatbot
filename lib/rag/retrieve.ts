import { embedQuery } from "./embeddings";
import { searchChunks, listDocuments, type RetrievedChunk } from "./vectorstore";
import { rerank } from "./rerank";
import { expandQuery } from "./expand";
import { config } from "../config";
import type { Source } from "../types";
import type { WebResult } from "../websearch";

export type { Source };

export interface RetrieveOptions {
  useRerank?: boolean;
  expand?: boolean;
  docIds?: string[];
}

/**
 * Retrieve doc chunks for a query. Optionally expands the query into variants
 * (multi-query), scopes to selected documents, and hybrid-reranks. n is assigned later.
 */
export async function retrieve(
  query: string,
  k = config.topK,
  opts: RetrieveOptions = {},
): Promise<Source[]> {
  const { useRerank = true, expand = false, docIds } = opts;
  const queries = expand ? await expandQuery(query) : [query];
  const fetchK = useRerank ? Math.min(k * 5, 40) : k;

  // Run each query, merge candidates by chunk id keeping the best score.
  const merged = new Map<string, RetrievedChunk>();
  for (const q of queries) {
    const vector = await embedQuery(q);
    const hits = await searchChunks(vector, fetchK, docIds);
    for (const h of hits) {
      const prev = merged.get(h.id);
      if (!prev || h.score > prev.score) merged.set(h.id, h);
    }
  }

  let candidates = [...merged.values()].sort((a, b) => b.score - a.score);
  candidates = useRerank ? rerank(query, candidates, k) : candidates.slice(0, k);

  const docs = await listDocuments();
  const extById = new Map(docs.map((d) => [d.id, d.ext]));

  return candidates.map((h) => ({
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
