"""Thin async client over the local Ollama HTTP API."""

import json
from collections.abc import AsyncIterator

import httpx

from .config import settings

Message = dict[str, str]


async def chat_stream(
    model: str,
    messages: list[Message],
    temperature: float = 0.4,
) -> AsyncIterator[str]:
    """Stream assistant text deltas from Ollama /api/chat."""
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "keep_alive": settings.ollama_keep_alive,
        "options": {"temperature": temperature},
    }
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", f"{settings.ollama_base_url}/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                obj = json.loads(line)
                delta = obj.get("message", {}).get("content")
                if delta:
                    yield delta
                if obj.get("done"):
                    break


async def chat_complete(
    model: str,
    messages: list[Message],
    temperature: float = 0.0,
    max_tokens: int | None = None,
) -> str:
    """Non-streamed chat completion (used by the guardrail and title generation)."""
    payload: dict = {
        "model": model,
        "messages": messages,
        "stream": False,
        "keep_alive": settings.ollama_keep_alive,
        "options": {"temperature": temperature},
    }
    if max_tokens is not None:
        payload["options"]["num_predict"] = max_tokens
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(f"{settings.ollama_base_url}/chat", json=payload)
        resp.raise_for_status()
        return resp.json().get("message", {}).get("content", "")


async def embed(inputs: list[str]) -> list[list[float]]:
    if not inputs:
        return []
    payload = {"model": settings.embed_model, "input": inputs, "keep_alive": settings.ollama_keep_alive}
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(f"{settings.ollama_base_url}/embed", json=payload)
        resp.raise_for_status()
        data = resp.json()
    embeddings = data.get("embeddings")
    if not embeddings:
        raise RuntimeError("Ollama returned no embeddings")
    return embeddings


async def is_online() -> bool:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{settings.ollama_base_url}/tags")
            return resp.status_code == 200
    except Exception:
        return False
