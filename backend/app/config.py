from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ollama_base_url: str = "http://127.0.0.1:11434/api"
    chat_model: str = "qwen2.5:7b-instruct"
    chat_model_fast: str = "llama3.2:3b"
    guard_model: str = "llama-guard3:1b"
    guard_block: str = "S1,S2,S3,S4,S9,S10,S11,S12,S14"
    embed_model: str = "nomic-embed-text"
    embed_dim: int = 768
    ollama_keep_alive: str = "30m"

    rag_top_k: int = 4
    rag_chunk_size: int = 900
    rag_chunk_overlap: int = 120
    history_budget: int = 8000

    data_dir: str = "./data"
    uploads_dir: str = "./uploads"
    allow_origin: str = "http://localhost:3000"

    @property
    def guard_block_set(self) -> set[str]:
        return {c.strip().upper() for c in self.guard_block.split(",") if c.strip()}

    @property
    def chat_models(self) -> list[dict[str, str]]:
        return [
            {"id": self.chat_model_fast, "label": "Llama 3.2 3B", "hint": "Fast and light"},
            {"id": self.chat_model, "label": "Qwen2.5 7B", "hint": "Slower, best quality"},
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
