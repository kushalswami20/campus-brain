"""Application configuration.

Settings are read once from the environment and validated by Pydantic. A bad
environment fails fast at startup rather than surfacing as a runtime error deep
in a request. AI-provider keys are optional until Milestone 4/5 so the service
skeleton can run and be tested without them.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = Field(default="development")
    port: int = Field(default=8000)
    log_level: str = Field(default="INFO")

    # Shared secret for service-to-service auth (NestJS -> AI). When empty, the
    # dependency is a no-op (convenient for local dev); set it in production.
    service_api_key: str = Field(default="")

    # AI providers — optional until their milestones.
    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="gpt-4.1")
    embedding_model: str = Field(default="text-embedding-3-large")

    pinecone_api_key: str = Field(default="")
    pinecone_index: str = Field(default="campusbrain")

    # Cross-encoder reranker model. Empty ⇒ deterministic lexical reranker (no
    # torch). Set to e.g. "cross-encoder/ms-marco-MiniLM-L-6-v2" when
    # sentence-transformers is installed.
    reranker_model: str = Field(default="")

    ai_redis_url: str = Field(default="")

    # Generation defaults.
    default_top_k: int = Field(default=8)
    request_timeout_seconds: int = Field(default=60)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def providers_ready(self) -> bool:
        """True when the keys needed for real RAG (M4/M5) are present."""
        return bool(self.openai_api_key and self.pinecone_api_key)


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so the environment is parsed exactly once."""
    return Settings()
