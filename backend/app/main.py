"""FastAPI application entrypoint."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.session import close_engine, init_engine
from app.logging import configure_logging, logger
from app.routers import (
    admin,
    alignments,
    auth,
    files,
    health,
    project_members,
    projects,
    users,
    verticals,
)
from app.s3 import init_s3


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    init_engine()
    init_s3(settings)
    logger.info("startup", app=settings.app_name, version=settings.app_version)
    yield
    await close_engine()
    logger.info("shutdown", app=settings.app_name)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="AI Native Web 3D CAD Platform — backend API",
        lifespan=_lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(users.router)
    app.include_router(projects.router)
    app.include_router(files.router)
    app.include_router(alignments.router)
    app.include_router(verticals.router)
    app.include_router(project_members.router)

    return app


app = create_app()
