"""FAISS-backed vector store with a JSON metadata sidecar and a document manifest.

FAISS only holds vectors keyed by int64 ids, so chunk metadata (docId, page, text,
...) lives alongside in `faiss_meta.json`, and the document list in `documents.json`.
Cosine similarity is achieved with normalized vectors + inner-product index.
"""

import json
import os
from dataclasses import dataclass

import faiss
import numpy as np

from ..config import settings


@dataclass
class ChunkRow:
    doc_id: str
    doc_name: str
    page: int
    chunk_index: int
    text: str
    vector: list[float]


@dataclass
class RetrievedChunk:
    id: int
    doc_id: str
    doc_name: str
    page: int
    text: str
    score: float


class FaissStore:
    def __init__(self, data_dir: str | None = None, dim: int | None = None):
        self.data_dir = data_dir or settings.data_dir
        self.dim = dim or settings.embed_dim
        os.makedirs(self.data_dir, exist_ok=True)
        self.index_path = os.path.join(self.data_dir, "faiss.index")
        self.meta_path = os.path.join(self.data_dir, "faiss_meta.json")
        self.manifest_path = os.path.join(self.data_dir, "documents.json")

        self.index = self._load_index()
        meta = self._read_json(self.meta_path, {"next_id": 0, "items": {}})
        self.next_id: int = meta["next_id"]
        self.items: dict[str, dict] = meta["items"]
        self.documents: list[dict] = self._read_json(self.manifest_path, [])

    # --- persistence ----------------------------------------------------
    def _load_index(self) -> faiss.Index:
        if os.path.exists(self.index_path):
            return faiss.read_index(self.index_path)
        return faiss.IndexIDMap2(faiss.IndexFlatIP(self.dim))

    @staticmethod
    def _read_json(path: str, default):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            return default

    def _save(self) -> None:
        faiss.write_index(self.index, self.index_path)
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump({"next_id": self.next_id, "items": self.items}, f, ensure_ascii=False)
        with open(self.manifest_path, "w", encoding="utf-8") as f:
            json.dump(self.documents, f, ensure_ascii=False, indent=2)

    # --- vectors --------------------------------------------------------
    @staticmethod
    def _normalize(vectors: np.ndarray) -> np.ndarray:
        vectors = np.ascontiguousarray(vectors, dtype=np.float32)
        faiss.normalize_L2(vectors)
        return vectors

    def add_chunks(self, rows: list[ChunkRow]) -> None:
        if not rows:
            return
        vectors = self._normalize(np.array([r.vector for r in rows], dtype=np.float32))
        ids = np.arange(self.next_id, self.next_id + len(rows), dtype=np.int64)
        self.index.add_with_ids(vectors, ids)
        for row, vid in zip(rows, ids, strict=True):
            self.items[str(int(vid))] = {
                "docId": row.doc_id,
                "docName": row.doc_name,
                "page": row.page,
                "chunkIndex": row.chunk_index,
                "text": row.text,
            }
        self.next_id += len(rows)
        self._save()

    def search(
        self,
        query_vector: list[float],
        k: int | None = None,
        doc_ids: list[str] | None = None,
    ) -> list[RetrievedChunk]:
        k = k or settings.rag_top_k
        if self.index.ntotal == 0:
            return []
        q = self._normalize(np.array([query_vector], dtype=np.float32))
        # Over-fetch when scoping so the doc filter still yields k results.
        fetch = min(self.index.ntotal, k * 10 if doc_ids else k)
        scores, ids = self.index.search(q, fetch)
        out: list[RetrievedChunk] = []
        for score, vid in zip(scores[0], ids[0], strict=True):
            if vid < 0:
                continue
            meta = self.items.get(str(int(vid)))
            if not meta:
                continue
            if doc_ids and meta["docId"] not in doc_ids:
                continue
            out.append(
                RetrievedChunk(
                    id=int(vid),
                    doc_id=meta["docId"],
                    doc_name=meta["docName"],
                    page=meta["page"],
                    text=meta["text"],
                    score=float(score),
                )
            )
            if len(out) >= k:
                break
        return out

    # --- documents ------------------------------------------------------
    def list_documents(self) -> list[dict]:
        return sorted(self.documents, key=lambda d: d.get("createdAt", ""), reverse=True)

    def get_document(self, doc_id: str) -> dict | None:
        return next((d for d in self.documents if d["id"] == doc_id), None)

    def register_document(self, meta: dict) -> None:
        self.documents = [d for d in self.documents if d["id"] != meta["id"]]
        self.documents.append(meta)
        self._save()

    def delete_document(self, doc_id: str) -> None:
        ids = [int(vid) for vid, m in self.items.items() if m["docId"] == doc_id]
        if ids:
            self.index.remove_ids(np.array(ids, dtype=np.int64))
            for vid in ids:
                self.items.pop(str(vid), None)
        self.documents = [d for d in self.documents if d["id"] != doc_id]
        self._save()


_store: FaissStore | None = None


def get_store() -> FaissStore:
    global _store
    if _store is None:
        _store = FaissStore()
    return _store
