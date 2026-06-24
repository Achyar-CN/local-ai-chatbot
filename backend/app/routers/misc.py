"""Small endpoints: health, warmup, conversation search, auto-title."""

import re

import httpx
from fastapi import APIRouter, Request

from ..config import settings
from ..ollama_client import chat_complete, is_online
from ..store import search_conversations

router = APIRouter()


@router.get("/api/health")
async def health():
    return {"online": await is_online()}


@router.post("/api/warmup")
async def warmup(req: Request):
    body = await req.json() if req.headers.get("content-type", "").startswith("application/json") else {}
    model = body.get("model") or settings.chat_model_fast
    base = settings.ollama_base_url
    payload_chat = {"model": model, "keep_alive": settings.ollama_keep_alive}
    payload_embed = {
        "model": settings.embed_model,
        "input": "warmup",
        "keep_alive": settings.ollama_keep_alive,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(f"{base}/generate", json=payload_chat)
            await client.post(f"{base}/embed", json=payload_embed)
    except Exception:  # noqa: BLE001
        pass
    return {"ok": True}


@router.get("/api/search")
async def search(q: str = ""):
    return {"hits": search_conversations(q)}


@router.post("/api/title")
async def title(req: Request):
    body = await req.json()
    snippet = (body.get("text") or "").strip()[:500]
    if not snippet:
        return {"title": "New conversation"}
    try:
        out = await chat_complete(
            settings.chat_model_fast,
            [
                {
                    "role": "system",
                    "content": (
                        "Write a VERY short title (max 6 words) for this conversation. "
                        "No quotes, no trailing period, no 'Title:' prefix, no dashes. "
                        "Match the language of the user's message."
                    ),
                },
                {"role": "user", "content": snippet},
            ],
            temperature=0.2,
            max_tokens=24,
        )
        cleaned = re.sub(r"[—–-]", " ", out).strip().strip("\"'.")
        cleaned = re.sub(r"\s+", " ", cleaned)[:60]
        return {"title": cleaned or "New conversation"}
    except Exception:  # noqa: BLE001
        return {"title": "New conversation"}
