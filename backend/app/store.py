"""Conversation persistence and search (port of lib/store.ts). JSON files on disk."""

import json
import os
from datetime import datetime, timezone

from .config import settings


def _chats_dir() -> str:
    return os.path.join(settings.data_dir, "chats")


def _index_path() -> str:
    return os.path.join(settings.data_dir, "conversations.json")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_index() -> list[dict]:
    try:
        with open(_index_path(), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return []


def _write_index(items: list[dict]) -> None:
    os.makedirs(settings.data_dir, exist_ok=True)
    with open(_index_path(), "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def _plain(message: dict) -> str:
    return " ".join(
        p.get("text", "") for p in message.get("parts", []) if p.get("type") == "text"
    )


def _derive_title(messages: list[dict]) -> str:
    first = next((m for m in messages if m.get("role") == "user"), None)
    text = _plain(first).strip() if first else ""
    if not text:
        return "New conversation"
    return text[:48] + "…" if len(text) > 48 else text


def list_conversations() -> list[dict]:
    return sorted(_read_index(), key=lambda c: c.get("updatedAt", ""), reverse=True)


def get_conversation(conv_id: str) -> dict | None:
    try:
        with open(os.path.join(_chats_dir(), f"{conv_id}.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def save_conversation(conv_id: str, messages: list[dict], title: str | None = None) -> dict:
    os.makedirs(_chats_dir(), exist_ok=True)
    index = _read_index()
    existing = next((c for c in index if c["id"] == conv_id), None)
    meta = {
        "id": conv_id,
        "title": title or (existing or {}).get("title") or _derive_title(messages),
        "createdAt": (existing or {}).get("createdAt") or _now(),
        "updatedAt": _now(),
        "messageCount": len(messages),
    }
    with open(os.path.join(_chats_dir(), f"{conv_id}.json"), "w", encoding="utf-8") as f:
        json.dump({**meta, "messages": messages}, f, ensure_ascii=False, indent=2)
    _write_index([meta] + [c for c in index if c["id"] != conv_id])
    return meta


def rename_conversation(conv_id: str, title: str) -> None:
    index = _read_index()
    meta = next((c for c in index if c["id"] == conv_id), None)
    if not meta:
        return
    meta["title"] = title
    meta["updatedAt"] = _now()
    _write_index(index)
    conv = get_conversation(conv_id)
    if conv:
        conv["title"] = title
        with open(os.path.join(_chats_dir(), f"{conv_id}.json"), "w", encoding="utf-8") as f:
            json.dump(conv, f, ensure_ascii=False, indent=2)


def delete_conversation(conv_id: str) -> None:
    _write_index([c for c in _read_index() if c["id"] != conv_id])
    try:
        os.remove(os.path.join(_chats_dir(), f"{conv_id}.json"))
    except OSError:
        pass


def search_conversations(query: str) -> list[dict]:
    q = query.strip().lower()
    if len(q) < 2:
        return []
    hits: list[dict] = []
    for meta in list_conversations():
        conv = get_conversation(meta["id"])
        if not conv:
            continue
        body = "  ".join(_plain(m) for m in conv.get("messages", []))
        hay = f"{meta['title']}  {body}".lower()
        at = hay.find(q)
        if at < 0:
            continue
        start = max(0, at - 40)
        snippet = f"{meta['title']}  {body}"[start : at + len(q) + 60].strip()
        hits.append({"id": meta["id"], "title": meta["title"], "snippet": snippet + "…"})
    return hits
