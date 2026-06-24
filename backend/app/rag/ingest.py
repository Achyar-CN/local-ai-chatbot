"""Ingestion pipeline: parse -> chunk -> embed -> store + keep the original file."""

import uuid
from datetime import datetime, timezone

from .chunk import chunk_pages
from .embeddings import embed_documents
from .faiss_store import ChunkRow, get_store
from .files import ext_of, save_original
from .parse import parse_file


async def ingest_file(buffer: bytes, filename: str, mime: str) -> dict:
    pages = parse_file(buffer, filename, mime)
    chunks = chunk_pages(pages)
    if not chunks:
        raise ValueError("No extractable text found in this document.")

    vectors = await embed_documents([c["text"] for c in chunks])
    doc_id = uuid.uuid4().hex

    rows = [
        ChunkRow(
            doc_id=doc_id,
            doc_name=filename,
            page=c["page"],
            chunk_index=i,
            text=c["text"],
            vector=vectors[i],
        )
        for i, c in enumerate(chunks)
    ]

    store = get_store()
    store.add_chunks(rows)

    ext = ext_of(filename)
    save_original(doc_id, ext, buffer)

    meta = {
        "id": doc_id,
        "name": filename,
        "size": len(buffer),
        "chunks": len(rows),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "ext": ext,
        "mime": mime or None,
    }
    store.register_document(meta)
    return meta
