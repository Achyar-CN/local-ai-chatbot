"""Persist original uploaded files so the source viewer can show them."""

import os

from ..config import settings

MIME_BY_EXT = {
    "pdf": "application/pdf",
    "txt": "text/plain; charset=utf-8",
    "md": "text/markdown; charset=utf-8",
    "markdown": "text/markdown; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "json": "application/json; charset=utf-8",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _path(doc_id: str, ext: str) -> str:
    return os.path.join(settings.uploads_dir, f"{doc_id}.{ext}")


def save_original(doc_id: str, ext: str, buffer: bytes) -> None:
    os.makedirs(settings.uploads_dir, exist_ok=True)
    with open(_path(doc_id, ext), "wb") as f:
        f.write(buffer)


def read_original(doc_id: str, ext: str) -> bytes | None:
    try:
        with open(_path(doc_id, ext), "rb") as f:
            return f.read()
    except OSError:
        return None


def delete_original(doc_id: str, ext: str) -> None:
    try:
        os.remove(_path(doc_id, ext))
    except OSError:
        pass
