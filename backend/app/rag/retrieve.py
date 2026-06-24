"""Retrieve document chunks and build the grounded system prompt."""

from .embeddings import embed_query
from .faiss_store import get_store

STYLE_RULE = (
    "Write naturally; do not use em-dashes or arrows. "
    "To draw a chart, output a fenced code block tagged chart with JSON like "
    '{"type":"line","title":"GDP","data":[{"x":"2005","GDP":100}],"series":[{"key":"GDP"}]}. '
    "type is line, bar, area, or pie. Never output HTML or script tags."
)


async def retrieve(query: str, k: int, doc_ids: list[str] | None = None) -> list[dict]:
    """Vector search over documents. Returns source dicts (n assigned later)."""
    vector = await embed_query(query)
    hits = get_store().search(vector, k, doc_ids)
    ext_by_id = {d["id"]: d.get("ext") for d in get_store().list_documents()}
    return [
        {
            "n": 0,
            "kind": "doc",
            "docName": h.doc_name,
            "docId": h.doc_id,
            "page": h.page,
            "ext": ext_by_id.get(h.doc_id),
            "text": h.text,
            "score": round(h.score, 3),
        }
        for h in hits
    ]


def number_sources(*groups: list[dict]) -> list[dict]:
    out: list[dict] = []
    n = 1
    for group in groups:
        for s in group:
            out.append({**s, "n": n})
            n += 1
    return out


def build_system_prompt(sources: list[dict]) -> str:
    if not sources:
        return (
            "You are a helpful, accurate local AI assistant. Answer clearly in the "
            "user's language. " + STYLE_RULE
        )
    context = "\n\n".join(
        f"[{s['n']}] ({s['docName']}, page {s.get('page')})\n{s['text']}" for s in sources
    )
    return (
        "You are a local AI assistant answering from the CONTEXT below.\n"
        "Rules:\n"
        "- Prefer the CONTEXT to answer.\n"
        "- Cite sources with [n] markers matching the chunk numbers you use.\n"
        "- If the CONTEXT lacks the answer, say so and do not invent it.\n"
        "- Be concise and answer in the user's language.\n"
        f"- {STYLE_RULE}\n\n"
        "CONTEXT:\n" + context
    )
