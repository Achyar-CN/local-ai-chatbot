import { embedQuery } from "./embeddings";
import { searchChunks, type RetrievedChunk } from "./vectorstore";
import { config } from "../config";

export interface Source {
  n: number;
  docName: string;
  page: number;
  text: string;
  score: number;
}

/** Retrieve top-k chunks for a query and shape them into citable sources. */
export async function retrieve(query: string, k = config.topK): Promise<Source[]> {
  const vector = await embedQuery(query);
  const hits = await searchChunks(vector, k);
  return hits.map((h: RetrievedChunk, i) => ({
    n: i + 1,
    docName: h.docName,
    page: h.page,
    text: h.text,
    score: Number(h.score.toFixed(3)),
  }));
}

/** Build the grounded system prompt fed to the chat model. */
export function buildSystemPrompt(sources: Source[]): string {
  if (sources.length === 0) {
    return [
      "Kamu adalah asisten AI lokal yang membantu dan akurat.",
      "Tidak ada dokumen relevan yang ditemukan untuk pertanyaan ini.",
      "Jawab dari pengetahuan umummu, dan katakan dengan jujur bila tidak yakin.",
    ].join(" ");
  }

  const context = sources
    .map((s) => `[${s.n}] (${s.docName}, hal. ${s.page})\n${s.text}`)
    .join("\n\n");

  return [
    "Kamu adalah asisten AI lokal yang menjawab berdasarkan KONTEKS dokumen di bawah.",
    "Aturan:",
    "- Utamakan informasi dari KONTEKS untuk menjawab.",
    "- Sitasikan sumber memakai penanda [n] sesuai nomor potongan yang kamu pakai.",
    "- Jika KONTEKS tidak memuat jawabannya, katakan demikian dan jangan mengarang.",
    "- Jawab ringkas, jelas, dan dalam bahasa yang sama dengan pertanyaan pengguna.",
    "",
    "KONTEKS:",
    context,
  ].join("\n");
}
