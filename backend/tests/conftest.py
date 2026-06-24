import pytest

from app.config import settings


@pytest.fixture
def tmp_data(tmp_path, monkeypatch):
    """Point storage at a temp dir so tests never touch real data."""
    monkeypatch.setattr(settings, "data_dir", str(tmp_path / "data"))
    monkeypatch.setattr(settings, "uploads_dir", str(tmp_path / "uploads"))
    return tmp_path
