"""Async session factory wired to the configured DATABASE_URL."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_engine() -> None:
    global _engine, _session_factory
    settings = get_settings()
    _engine = create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def close_engine() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields one AsyncSession per request."""
    if _session_factory is None:
        raise RuntimeError("Database engine not initialised — call init_engine() first")
    async with _session_factory() as session:
        yield session


def new_session() -> AsyncSession:
    """Return a new AsyncSession for use outside of dependency injection (e.g. health checks)."""
    if _session_factory is None:
        raise RuntimeError("Database engine not initialised — call init_engine() first")
    return _session_factory()
