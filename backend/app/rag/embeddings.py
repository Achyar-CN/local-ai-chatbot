"""Embeddings via Ollama. nomic-embed-text uses task prefixes for better retrieval."""

from .. import ollama_client


async def embed_documents(texts: list[str]) -> list[list[float]]:
    return await ollama_client.embed([f"search_document: {t}" for t in texts])


async def embed_query(text: str) -> list[float]:
    vecs = await ollama_client.embed([f"search_query: {text}"])
    return vecs[0]
