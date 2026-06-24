from app.config import Settings


def test_defaults():
    s = Settings()
    assert s.embed_dim == 768
    assert s.rag_top_k == 4
    assert "S1" in s.guard_block_set


def test_chat_models_default_fast_first():
    s = Settings()
    models = s.chat_models
    assert models[0]["id"] == s.chat_model_fast


def test_guard_block_override(monkeypatch):
    monkeypatch.setenv("GUARD_BLOCK", "S1, s2 ,S3")
    s = Settings()
    assert s.guard_block_set == {"S1", "S2", "S3"}
