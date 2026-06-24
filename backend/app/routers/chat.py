from dataclasses import asdict

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ..ai_stream import STREAM_HEADERS, STREAM_MEDIA_TYPE, assistant_stream, static_stream
from ..config import settings
from ..guardrail import moderate, refusal_message
from ..ollama_client import chat_stream
from ..rag.retrieve import build_system_prompt, number_sources, retrieve

router = APIRouter()


def _message_text(message: dict) -> str:
    return " ".join(
        p.get("text", "") for p in message.get("parts", []) if p.get("type") == "text"
    ).strip()


def _last_user_text(messages: list[dict]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user":
            return _message_text(m)
    return ""


def _trim_history(messages: list[dict], budget: int) -> list[dict]:
    if len(messages) <= 2:
        return messages
    kept: list[dict] = []
    total = 0
    for m in reversed(messages):
        length = len(_message_text(m))
        if kept and total + length > budget:
            break
        kept.append(m)
        total += length
    return list(reversed(kept))


def _to_model_messages(messages: list[dict], system: str) -> list[dict]:
    out = [{"role": "system", "content": system}]
    for m in _trim_history(messages, settings.history_budget):
        text = _message_text(m)
        if text and m.get("role") in ("user", "assistant"):
            out.append({"role": m["role"], "content": text})
    return out


@router.post("/api/chat")
async def chat(req: Request):
    body = await req.json()
    messages: list[dict] = body.get("messages", [])
    use_rag = body.get("useRag", True)
    guard = body.get("guard", False)
    model = body.get("model")
    top_k = body.get("topK")
    doc_ids = body.get("docIds")
    has_docs = body.get("hasDocs", False)

    valid_models = {m["id"] for m in settings.chat_models}
    chat_model = model if model in valid_models else settings.chat_model
    k = round(top_k) if isinstance(top_k, (int, float)) and 0 < top_k <= 10 else settings.rag_top_k
    query = _last_user_text(messages)

    # Guardrail: moderate the input before doing anything else.
    if guard and query:
        verdict = await moderate(query, "user")
        if not verdict.safe:
            return StreamingResponse(
                static_stream(refusal_message(verdict), data_parts=[("guardrail", asdict(verdict))]),
                media_type=STREAM_MEDIA_TYPE,
                headers=STREAM_HEADERS,
            )

    # Retrieval (Phase 1: documents only).
    sources: list[dict] = []
    if use_rag and has_docs and query:
        try:
            sources = number_sources(await retrieve(query, k, doc_ids))
        except Exception as err:  # noqa: BLE001
            print("RAG retrieval failed:", err)

    system = build_system_prompt(sources)
    model_messages = _to_model_messages(messages, system)

    async def deltas():
        try:
            async for d in chat_stream(chat_model, model_messages, temperature=0.4):
                yield d
        except Exception as err:  # noqa: BLE001
            print("Chat stream error:", err)
            yield "Could not reach the model. Make sure Ollama is running (ollama serve)."

    data_parts = [("sources", sources)] if sources else None
    return StreamingResponse(
        assistant_stream(deltas(), data_parts),
        media_type=STREAM_MEDIA_TYPE,
        headers=STREAM_HEADERS,
    )
