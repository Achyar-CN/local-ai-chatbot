"""Recursive character chunker (port of the TypeScript lib/rag/chunk.ts)."""

import re

from ..config import settings


def _clean(text: str) -> str:
    text = text.replace("\r\n", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_by_words(text: str, chunk_size: int) -> list[str]:
    words = text.split()
    out: list[str] = []
    buf = ""
    for w in words:
        if len(buf) + len(w) + 1 > chunk_size and buf:
            out.append(buf.strip())
            buf = ""
        buf += (" " if buf else "") + w
    if buf.strip():
        out.append(buf.strip())
    return out


def _split_long(text: str, chunk_size: int) -> list[str]:
    sentences = re.findall(r"[^.!?\n]+[.!?]?\s*", text) or [text]
    out: list[str] = []
    buf = ""
    for s in sentences:
        pieces = _split_by_words(s, chunk_size) if len(s) > chunk_size else [s]
        for p in pieces:
            if len(buf) + len(p) > chunk_size and buf:
                out.append(buf.strip())
                buf = ""
            buf += p
    if buf.strip():
        out.append(buf.strip())
    return out


def chunk_pages(
    pages: list[dict],
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[dict]:
    """Split page-segmented text into overlapping chunks, keeping page numbers."""
    chunk_size = chunk_size or settings.rag_chunk_size
    overlap = overlap or settings.rag_chunk_overlap
    chunks: list[dict] = []

    for page in pages:
        cleaned = _clean(page.get("text", ""))
        if not cleaned:
            continue
        paragraphs = re.split(r"\n{2,}", cleaned)
        buf = ""

        def flush(page_num: int) -> str:
            nonlocal buf
            trimmed = buf.strip()
            if trimmed:
                chunks.append({"text": trimmed, "page": page_num})
            return trimmed[-overlap:] if overlap > 0 else ""

        for para in paragraphs:
            units = _split_long(para, chunk_size) if len(para) > chunk_size else [para]
            for unit in units:
                if len(buf) + len(unit) + 1 > chunk_size and buf.strip():
                    buf = flush(page["page"])
                buf += ("\n" if buf else "") + unit
        if buf.strip():
            chunks.append({"text": buf.strip(), "page": page["page"]})
            buf = ""

    return chunks
