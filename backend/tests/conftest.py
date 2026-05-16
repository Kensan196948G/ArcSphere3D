"""Test fixtures — sets up a real Postgres DB for integration tests.

TestClient doesn't trigger FastAPI's lifespan unless used as a context
manager, so we call init_engine() here at import time so every route
handler can reach get_session() without raising RuntimeError.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import create_engine, text

from app.config import get_settings
from app.db.base import Base
from app.db.session import init_engine

# Initialise the app's async engine before any test function runs.
init_engine()


@pytest.fixture(scope="session", autouse=True)
def _db_schema() -> None:
    """Drop and recreate all tables once for the entire test session."""
    engine = create_engine(get_settings().database_url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    engine.dispose()


@pytest.fixture(autouse=True)
def _db_truncate(_db_schema: None) -> None:
    """Truncate all tables before each test so state does not bleed between tests."""
    engine = create_engine(get_settings().database_url)
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users, projects, files CASCADE"))
    engine.dispose()


@pytest.fixture(autouse=True)
def _mock_s3() -> None:
    """Patch all S3 helpers where files router imported them — tests need no real S3."""
    presign_mock = AsyncMock(return_value="https://s3.example.com/presigned")
    with (
        patch("app.routers.files.put_object", new_callable=AsyncMock),
        patch("app.routers.files.delete_object", new_callable=AsyncMock),
        patch("app.routers.files.generate_presigned_url", presign_mock),
    ):
        yield
