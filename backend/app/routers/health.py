"""Health / readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthOut)
def healthz() -> HealthOut:
    """Liveness probe — always returns ok if the process is running."""
    s = get_settings()
    return HealthOut(status="ok", version=s.app_version, env=s.app_env)


@router.get("/readyz", response_model=HealthOut, responses={503: {"description": "not ready"}})
async def readyz() -> HealthOut:
    """Readiness probe — verifies database connectivity before returning ready."""
    from sqlalchemy import text

    from app.db.session import new_session

    s = get_settings()
    try:
        async with new_session() as session:
            await session.execute(text("SELECT 1"))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="database not initialised") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="database not ready") from exc

    return HealthOut(status="ready", version=s.app_version, env=s.app_env, db="ok")
