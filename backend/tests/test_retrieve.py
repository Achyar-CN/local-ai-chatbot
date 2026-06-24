import pytest

from app.rag import retrieve as retrieve_mod
from app.rag.faiss_store import ChunkRow, FaissStore
from app.rag.retrieve import build_system_prompt, number_sources


@pytest.fixture
def populated_store(tmp_path):
    store = FaissStore(data_dir=str(tmp_path / "data"), dim=4)
    store.add_chunks([
        ChunkRow("d1", "doc1.txt", 1, 0, "Atlas uses FAISS for vectors.", [1, 0, 0, 0]),
        ChunkRow("d1", "doc1.txt", 2, 1, "Unrelated text here.", [0, 1, 0, 0]),
    ])
    store.register_document({"id": "d1", "name": "doc1.txt", "ext": "txt", "createdAt": "z"})
    return store


async def test_retrieve_returns_sources(monkeypatch, populated_store):
    async def fake_embed_query(_q):
        return [1, 0, 0, 0]

    monkeypatch.setattr(retrieve_mod, "embed_query", fake_embed_query)
    monkeypatch.setattr(retrieve_mod, "get_store", lambda: populated_store)

    sources = await retrieve_mod.retrieve("what vector store?", k=1)
    assert len(sources) == 1
    s = sources[0]
    assert s["kind"] == "doc"
    assert s["docId"] == "d1"
    assert s["ext"] == "txt"
    assert "FAISS" in s["text"]


def test_number_sources_assigns_sequential_n():
    a = [{"kind": "doc", "text": "x"}]
    b = [{"kind": "web", "text": "y"}]
    numbered = number_sources(a, b)
    assert [s["n"] for s in numbered] == [1, 2]


def test_build_system_prompt_modes():
    assert "CONTEXT" not in build_system_prompt([])
    grounded = build_system_prompt([{"n": 1, "docName": "d", "page": 2, "text": "hello"}])
    assert "CONTEXT" in grounded and "[1]" in grounded
