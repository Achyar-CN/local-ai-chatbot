from app.rag.faiss_store import ChunkRow, FaissStore


def _row(doc_id, idx, vector, text="t"):
    return ChunkRow(doc_id=doc_id, doc_name=doc_id, page=1, chunk_index=idx, text=text, vector=vector)


def make_store(tmp_path):
    return FaissStore(data_dir=str(tmp_path / "data"), dim=4)


def test_add_and_search_returns_closest(tmp_path):
    store = make_store(tmp_path)
    store.add_chunks([
        _row("d1", 0, [1, 0, 0, 0], "alpha"),
        _row("d1", 1, [0, 1, 0, 0], "beta"),
        _row("d2", 0, [0, 0, 1, 0], "gamma"),
    ])
    hits = store.search([1, 0, 0, 0], k=1)
    assert len(hits) == 1
    assert hits[0].text == "alpha"
    assert hits[0].score > 0.9


def test_doc_id_scoping(tmp_path):
    store = make_store(tmp_path)
    store.add_chunks([
        _row("d1", 0, [1, 0, 0, 0], "alpha"),
        _row("d2", 0, [1, 0, 0, 0], "gamma"),
    ])
    hits = store.search([1, 0, 0, 0], k=5, doc_ids=["d2"])
    assert hits and all(h.doc_id == "d2" for h in hits)


def test_delete_document(tmp_path):
    store = make_store(tmp_path)
    store.add_chunks([_row("d1", 0, [1, 0, 0, 0]), _row("d2", 0, [0, 1, 0, 0])])
    store.register_document({"id": "d1", "name": "d1", "ext": "txt", "createdAt": "z"})
    store.delete_document("d1")
    hits = store.search([1, 0, 0, 0], k=5)
    assert all(h.doc_id != "d1" for h in hits)
    assert store.get_document("d1") is None


def test_persistence_round_trip(tmp_path):
    store = make_store(tmp_path)
    store.add_chunks([_row("d1", 0, [1, 0, 0, 0], "persisted")])
    reopened = make_store(tmp_path)
    hits = reopened.search([1, 0, 0, 0], k=1)
    assert hits[0].text == "persisted"


def test_empty_search(tmp_path):
    assert make_store(tmp_path).search([1, 0, 0, 0], k=3) == []
