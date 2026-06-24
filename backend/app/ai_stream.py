"""Helpers that replicate the Vercel AI SDK UI message stream wire format so the
existing Next.js `useChat` frontend works against this Python backend unchanged.

Wire format: SSE lines `data: <json>\\n\\n`, terminated by `data: [DONE]`.
Chunk order: start -> (data-*) -> text-start -> text-delta* -> text-end -> finish.
"""

import json
import uuid
from collections.abc import AsyncIterator, Iterator
from typing import Any

# Content-Type is set via StreamingResponse(media_type="text/event-stream").
STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "x-vercel-ai-ui-message-stream": "v1",
}
STREAM_MEDIA_TYPE = "text/event-stream"

DONE = "data: [DONE]\n\n"


def sse(obj: dict[str, Any]) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


def new_id() -> str:
    return uuid.uuid4().hex


def _data_parts(data_parts: list[tuple[str, Any]] | None) -> Iterator[str]:
    for name, data in data_parts or []:
        yield sse({"type": f"data-{name}", "data": data})


async def assistant_stream(
    deltas: AsyncIterator[str],
    data_parts: list[tuple[str, Any]] | None = None,
) -> AsyncIterator[str]:
    """Full assistant turn: optional data parts then streamed text."""
    yield sse({"type": "start"})
    for chunk in _data_parts(data_parts):
        yield chunk
    tid = new_id()
    yield sse({"type": "text-start", "id": tid})
    async for delta in deltas:
        if delta:
            yield sse({"type": "text-delta", "id": tid, "delta": delta})
    yield sse({"type": "text-end", "id": tid})
    yield sse({"type": "finish"})
    yield DONE


def static_stream(
    text: str,
    data_parts: list[tuple[str, Any]] | None = None,
) -> Iterator[str]:
    """Non-streamed assistant turn (e.g. a guardrail refusal). Synchronous."""
    yield sse({"type": "start"})
    for chunk in _data_parts(data_parts):
        yield chunk
    tid = new_id()
    yield sse({"type": "text-start", "id": tid})
    yield sse({"type": "text-delta", "id": tid, "delta": text})
    yield sse({"type": "text-end", "id": tid})
    yield sse({"type": "finish"})
    yield DONE
