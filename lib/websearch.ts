/**
 * Keyless web search. Tries backends in order until one returns results:
 *   1. SearXNG JSON  (if SEARXNG_URL set — most reliable, e.g. self-hosted)
 *   2. DuckDuckGo Lite HTML
 *   3. DuckDuckGo HTML
 * No API key, nothing logged, nothing persisted.
 */
import { config } from "./config";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  text: string;
}

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** DuckDuckGo wraps result URLs in a redirect; pull the real one out. */
export function unwrap(href: string): string {
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  return href.startsWith("//") ? `https:${href}` : href;
}

// --- parsers (pure, unit-testable) --------------------------------------

export function parseDdgHtml(html: string, limit: number) {
  const out: { title: string; url: string; snippet: string }[] = [];
  const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html))) snippets.push(stripTags(sm[1]));
  let lm: RegExpExecArray | null;
  let i = 0;
  while ((lm = linkRe.exec(html)) && out.length < limit) {
    const u = unwrap(lm[1]);
    if (/^https?:\/\//.test(u)) {
      out.push({ title: stripTags(lm[2]) || u, url: u, snippet: snippets[i] ?? "" });
    }
    i++;
  }
  return out;
}

export function parseDdgLite(html: string, limit: number) {
  const out: { title: string; url: string; snippet: string }[] = [];
  const linkRe = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html))) snippets.push(stripTags(sm[1]));
  let lm: RegExpExecArray | null;
  let i = 0;
  while ((lm = linkRe.exec(html)) && out.length < limit) {
    const u = unwrap(lm[1]);
    if (/^https?:\/\//.test(u)) {
      out.push({ title: stripTags(lm[2]) || u, url: u, snippet: snippets[i] ?? "" });
    }
    i++;
  }
  return out;
}

export function parseSearxng(json: unknown, limit: number) {
  const results = (json as { results?: { title?: string; url?: string; content?: string }[] })
    ?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r) => r.url && /^https?:\/\//.test(r.url))
    .slice(0, limit)
    .map((r) => ({ title: r.title ?? r.url!, url: r.url!, snippet: r.content ?? "" }));
}

// --- fetching -----------------------------------------------------------

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, headers: { "User-Agent": UA, ...init?.headers }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(url, 6000);
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.includes("text/html")) return "";
    const html = await res.text();
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
    return stripTags(body).slice(0, 1800);
  } catch {
    return "";
  }
}

type Hit = { title: string; url: string; snippet: string };

async function viaSearxng(query: string, limit: number): Promise<Hit[]> {
  if (!config.searxngUrl) return [];
  const url = `${config.searxngUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}&format=json&safesearch=1`;
  const res = await fetchWithTimeout(url, 8000, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  return parseSearxng(await res.json(), limit);
}

async function viaDdgLite(query: string, limit: number): Promise<Hit[]> {
  const res = await fetchWithTimeout("https://lite.duckduckgo.com/lite/", 8000, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `q=${encodeURIComponent(query)}`,
  });
  if (!res.ok) return [];
  return parseDdgLite(await res.text(), limit);
}

async function viaDdgHtml(query: string, limit: number): Promise<Hit[]> {
  const res = await fetchWithTimeout(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    8000,
  );
  if (!res.ok) return [];
  return parseDdgHtml(await res.text(), limit);
}

export async function webSearch(query: string, limit = 3): Promise<WebResult[]> {
  let hits: Hit[] = [];
  for (const backend of [viaSearxng, viaDdgLite, viaDdgHtml]) {
    try {
      hits = await backend(query, limit);
      if (hits.length > 0) break;
    } catch (err) {
      console.error(`websearch backend ${backend.name} failed:`, err);
    }
  }
  if (hits.length === 0) return [];

  // Enrich with a little page body text (best-effort, parallel).
  return Promise.all(
    hits.map(async (r) => ({ ...r, text: (await fetchPageText(r.url)) || r.snippet })),
  );
}
