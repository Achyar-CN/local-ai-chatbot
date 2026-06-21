import type { RetrievedChunk } from "./vectorstore";

/**
 * Hybrid rerank: fuse the vector ranking with a lexical BM25 ranking over the
 * candidate set using Reciprocal Rank Fusion. Catches exact keyword matches the
 * embedding misses — no extra model, runs in microseconds. Keyless & local.
 */

const K1 = 1.5;
const B = 0.75;
const RRF_K = 60;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function bm25Ranking(query: string, docs: string[]): number[] {
  const qTerms = [...new Set(tokenize(query))];
  const docTokens = docs.map(tokenize);
  const docLen = docTokens.map((t) => t.length);
  const avgLen = docLen.reduce((a, b) => a + b, 0) / (docLen.length || 1);

  // document frequency per query term
  const df = new Map<string, number>();
  for (const term of qTerms) {
    let count = 0;
    for (const toks of docTokens) if (toks.includes(term)) count++;
    df.set(term, count);
  }

  const N = docs.length;
  return docTokens.map((toks, i) => {
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of qTerms) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + K1 * (1 - B + (B * docLen[i]) / (avgLen || 1));
      score += idf * ((f * (K1 + 1)) / denom);
    }
    return score;
  });
}

function rankIndices(scores: number[]): Map<number, number> {
  const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]);
  const rank = new Map<number, number>();
  order.forEach(([, idx], pos) => rank.set(idx, pos));
  return rank;
}

/**
 * Reorder candidates (already sorted by vector score) using RRF of vector rank
 * and BM25 rank, return the top `k`. Each result's `score` becomes the cosine
 * similarity of the chosen item (still meaningful for the UI).
 */
export function rerank(
  query: string,
  candidates: RetrievedChunk[],
  k: number,
): RetrievedChunk[] {
  if (candidates.length <= 1) return candidates.slice(0, k);

  const vectorRank = new Map<number, number>(candidates.map((_, i) => [i, i]));
  const bm25 = bm25Ranking(
    query,
    candidates.map((c) => c.text),
  );
  const lexRank = rankIndices(bm25);

  const fused = candidates
    .map((c, i) => {
      const rrf =
        1 / (RRF_K + (vectorRank.get(i) ?? i)) + 1 / (RRF_K + (lexRank.get(i) ?? i));
      return { c, rrf };
    })
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, k)
    .map(({ c }) => c);

  return fused;
}
