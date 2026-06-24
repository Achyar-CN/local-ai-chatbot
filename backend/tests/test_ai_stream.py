import json

from app.ai_stream import assistant_stream, static_stream


def _parse(lines: list[str]) -> list:
    chunks = []
    for line in lines:
        payload = line.removeprefix("data: ").strip()
        if payload == "[DONE]":
            chunks.append("[DONE]")
        else:
            chunks.append(json.loads(payload))
    return chunks


async def _collect(agen):
    return [x async for x in agen]


async def test_assistant_stream_order_and_framing():
    async def deltas():
        for d in ["Hel", "lo"]:
            yield d

    lines = await _collect(assistant_stream(deltas(), data_parts=[("sources", [{"n": 1}])]))
    assert all(line.startswith("data: ") and line.endswith("\n\n") for line in lines)
    chunks = _parse(lines)
    types = [c["type"] if isinstance(c, dict) else c for c in chunks]
    assert types[0] == "start"
    assert "data-sources" in types
    assert types[-1] == "[DONE]"
    assert "finish" in types
    deltas_text = "".join(c["delta"] for c in chunks if isinstance(c, dict) and c["type"] == "text-delta")
    assert deltas_text == "Hello"
    # text-start precedes text-delta precedes text-end
    assert types.index("text-start") < types.index("text-delta") < types.index("text-end")


def test_static_stream_includes_data_and_text():
    chunks = _parse(list(static_stream("blocked", data_parts=[("guardrail", {"safe": False})])))
    types = [c["type"] if isinstance(c, dict) else c for c in chunks]
    assert "data-guardrail" in types
    assert any(isinstance(c, dict) and c.get("delta") == "blocked" for c in chunks)
    assert types[-1] == "[DONE]"
