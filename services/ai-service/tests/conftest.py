"""Test isolation.

Providers are process-wide singletons via ``lru_cache``. Clearing them before
each test gives every test a fresh in-memory vector store, so state from one
test can't leak into another.
"""

from __future__ import annotations

import pytest

from app.api import deps


@pytest.fixture(autouse=True)
def reset_providers() -> None:
    deps.get_embedding_provider.cache_clear()
    deps.get_vector_store.cache_clear()
