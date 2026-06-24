from app import store


def _msg(role, text):
    return {"id": role, "role": role, "parts": [{"type": "text", "text": text}]}


def test_save_list_get_delete(tmp_data):
    messages = [_msg("user", "hello there"), _msg("assistant", "hi")]
    meta = store.save_conversation("c1", messages)
    assert meta["title"] == "hello there"
    assert meta["messageCount"] == 2

    listed = store.list_conversations()
    assert len(listed) == 1 and listed[0]["id"] == "c1"

    conv = store.get_conversation("c1")
    assert conv and len(conv["messages"]) == 2

    store.delete_conversation("c1")
    assert store.list_conversations() == []
    assert store.get_conversation("c1") is None


def test_rename(tmp_data):
    store.save_conversation("c1", [_msg("user", "x")])
    store.rename_conversation("c1", "Renamed")
    assert store.list_conversations()[0]["title"] == "Renamed"
    assert store.get_conversation("c1")["title"] == "Renamed"


def test_search(tmp_data):
    store.save_conversation("c1", [_msg("user", "tell me about photosynthesis")])
    store.save_conversation("c2", [_msg("user", "weather today")])
    hits = store.search_conversations("photosynthesis")
    assert len(hits) == 1 and hits[0]["id"] == "c1"
    assert store.search_conversations("zzz") == []
