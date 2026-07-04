"""Shared FastAPI dependencies: settings, auth, providers, and service wiring.

Providers and the compiled agent graph are process-wide singletons (``lru_cache``)
so ingestion and retrieval share one dense store, one sparse index, and one
embedding model. Concrete implementations are chosen by configuration: real
OpenAI/Pinecone when keys are present, otherwise deterministic fakes — the rest
of the code never knows the difference.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header

from app.agents.graph import RagPipeline
from app.core.config import Settings, get_settings
from app.core.errors import UnauthorizedServiceError
from app.services.ingestion.ingest_service import IngestService
from app.services.providers.embeddings import (
    EmbeddingProvider,
    FakeEmbeddingProvider,
    OpenAIEmbeddingProvider,
)
from app.services.providers.keyword_index import (
    InMemoryBM25Index,
    KeywordIndex,
)
from app.services.providers.llm import FakeLLM, LLMProvider, OpenAILLM
from app.services.providers.vector_store import (
    InMemoryVectorStore,
    PineconeVectorStore,
    VectorStore,
)
from app.services.rag_service import RagService
from app.services.study.study_service import StudyService

SettingsDep = Annotated[Settings, Depends(get_settings)]


def verify_service_key(
    settings: SettingsDep,
    x_service_key: Annotated[str | None, Header()] = None,
) -> None:
    """Enforce the shared service secret when one is configured (no-op in dev)."""
    expected = settings.service_api_key
    if not expected:
        return
    if x_service_key != expected:
        raise UnauthorizedServiceError("Invalid or missing service key.")


@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    settings = get_settings()
    if settings.openai_api_key:
        return OpenAIEmbeddingProvider(
            settings.openai_api_key, settings.embedding_model
        )
    return FakeEmbeddingProvider()


@lru_cache
def get_vector_store() -> VectorStore:
    settings = get_settings()
    if settings.pinecone_api_key:
        return PineconeVectorStore(
            settings.pinecone_api_key, settings.pinecone_index
        )
    return InMemoryVectorStore()


@lru_cache
def get_keyword_index() -> KeywordIndex:
    return InMemoryBM25Index()


@lru_cache
def get_llm_provider() -> LLMProvider:
    settings = get_settings()
    if settings.openai_api_key:
        return OpenAILLM(settings.openai_api_key, settings.openai_model)
    return FakeLLM()


@lru_cache
def get_pipeline() -> RagPipeline:
    settings = get_settings()
    return RagPipeline(
        embeddings=get_embedding_provider(),
        vector_store=get_vector_store(),
        keyword_index=get_keyword_index(),
        llm=get_llm_provider(),
        reranker_model=settings.reranker_model or None,
    )


def get_ingest_service() -> IngestService:
    return IngestService(
        get_embedding_provider(), get_vector_store(), get_keyword_index()
    )


def get_rag_service(settings: SettingsDep) -> RagService:
    return RagService(settings, get_pipeline())


def get_study_service() -> StudyService:
    return StudyService(
        get_embedding_provider(), get_vector_store(), get_llm_provider()
    )


RagServiceDep = Annotated[RagService, Depends(get_rag_service)]
IngestServiceDep = Annotated[IngestService, Depends(get_ingest_service)]
StudyServiceDep = Annotated[StudyService, Depends(get_study_service)]
