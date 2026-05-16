"""Health / readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings
from app.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthOut)
def healthz() -> HealthOut:
    s = get_settings()
    return HealthOut(status="ok", version=s.app_version, env=s.app_env)


@router.get("/readyz", response_model=HealthOut)
def readyz() -> HealthOut:
    s = get_settings()
    return HealthOut(status="ready", version=s.app_version, env=s.app_env)
