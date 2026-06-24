from app.rag.chunk import chunk_pages


def test_empty_pages_yield_nothing():
    assert chunk_pages([{"page": 1, "text": "   "}]) == []


def test_keeps_page_numbers():
    pages = [{"page": 3, "text": "Hello world. This is page three."}]
    chunks = chunk_pages(pages, chunk_size=100, overlap=10)
    assert chunks
    assert all(c["page"] == 3 for c in chunks)


def test_respects_chunk_size():
    long_text = " ".join(f"word{i}" for i in range(500))
    chunks = chunk_pages([{"page": 1, "text": long_text}], chunk_size=120, overlap=20)
    assert len(chunks) > 1
    assert all(len(c["text"]) <= 200 for c in chunks)


def test_splits_paragraphs():
    text = "First paragraph here.\n\nSecond paragraph here.\n\nThird one."
    chunks = chunk_pages([{"page": 1, "text": text}], chunk_size=25, overlap=0)
    assert len(chunks) >= 2
