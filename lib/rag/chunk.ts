import { config } from "../config";

export interface TextChunk {
  text: string;
  page: number;
}

export interface PageText {
  page: number;
  text: string;
}

/** Normalize whitespace without destroying paragraph boundaries. */
function clean(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Recursive character splitter: prefer paragraph, then sentence, then word
 * boundaries, packing up to `chunkSize` chars with `overlap` carry-over.
 * Operates per page so each chunk keeps an accurate page number for citations.
 */
export function chunkPages(
  pages: PageText[],
  chunkSize = config.chunkSize,
  overlap = config.chunkOverlap,
): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const { page, text } of pages) {
    const cleaned = clean(text);
    if (!cleaned) continue;

    const paragraphs = cleaned.split(/\n{2,}/);
    let buffer = "";

    const flush = () => {
      const trimmed = buffer.trim();
      if (trimmed.length > 0) chunks.push({ text: trimmed, page });
      // carry overlap from the tail of the flushed buffer
      buffer = overlap > 0 ? trimmed.slice(-overlap) : "";
    };

    for (const para of paragraphs) {
      const units = para.length > chunkSize ? splitLong(para, chunkSize) : [para];
      for (const unit of units) {
        if (buffer.length + unit.length + 1 > chunkSize && buffer.trim().length > 0) {
          flush();
        }
        buffer += (buffer ? "\n" : "") + unit;
      }
    }
    if (buffer.trim().length > 0) {
      chunks.push({ text: buffer.trim(), page });
      buffer = "";
    }
  }

  return chunks;
}

/** Break an oversized paragraph along sentence then word boundaries. */
function splitLong(text: string, chunkSize: number): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?]?\s*/g) ?? [text];
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    const piece = s.length > chunkSize ? splitByWords(s, chunkSize) : [s];
    for (const p of piece) {
      if (buf.length + p.length > chunkSize && buf) {
        out.push(buf.trim());
        buf = "";
      }
      buf += p;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function splitByWords(text: string, chunkSize: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let buf = "";
  for (const w of words) {
    if (buf.length + w.length + 1 > chunkSize && buf) {
      out.push(buf.trim());
      buf = "";
    }
    buf += (buf ? " " : "") + w;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
