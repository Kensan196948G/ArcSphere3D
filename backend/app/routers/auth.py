"""Auth endpoints (MVP scaffold).

WARNING: This is a *scaffold*. The MVP demo user is configured in-memory
and must be replaced by a real user store + Entra ID SSO before production.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from app.config import get_settings
from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.ratelimit import SimpleRateLimiter
from app.schemas import CurrentUser, LoginRequest, TokenResponse
from app.security import create_access_token, get_public_key_jwk, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 5 attempts per 60 seconds per client IP — brute-force mitigation.
_login_limiter = SimpleRateLimiter(max_calls=5, window_seconds=60)

# Demo users (MVP only). Replace with DB-backed store.
_DEMO_USERS: dict[str, dict[str, str]] = {
    "demo@arcsphere3d.dev": {
        "password_hash": hash_password("arcsphere-demo"),
        "role": "admin",
    },
    "other@arcsphere3d.dev": {
        "password_hash": hash_password("arcsphere-demo"),
        "role": "viewer",
    },
}


@router.get("/.well-known/jwks.json", tags=["auth"])
def jwks() -> dict[str, Any]:
    """Return the JWKS document (RFC 7517) containing the RS256 public key."""
    return {"keys": [get_public_key_jwk()]}


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        400: {"description": "malformed request body"},
        401: {"description": "invalid credentials"},
        429: {"description": "too many requests — rate limit exceeded"},
    },
)
async def login(request: Request, payload: LoginRequest, db: DbDep) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    if not _login_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too many login attempts — try again later",
            headers={"Retry-After": "60"},
        )
    user = _DEMO_USERS.get(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        await crud.log_audit_event(
            db,
            action="login_failed",
            resource_type="user",
            resource_id=payload.email,
            ip_address=client_ip,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )
    token = create_access_token(
        subject=payload.email,
        extra={"email": payload.email, "role": user["role"]},
    )
    await crud.log_audit_event(
        db,
        action="login_success",
        resource_type="user",
        resource_id=payload.email,
        ip_address=client_ip,
    )
    await db.commit()
    s = get_settings()
    return TokenResponse(
        access_token=token,
        expires_in=s.jwt_access_token_ttl_minutes * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={
        400: {"description": "malformed request body"},
        401: {"description": "invalid or missing token"},
    },
)
async def refresh(db: DbDep, current: CurrentUser = CurrentUserDep) -> TokenResponse:
    token = create_access_token(
        subject=current.sub,
        extra={"email": current.email, "role": current.role},
    )
    await crud.log_audit_event(
        db,
        action="token_refreshed",
        resource_type="user",
        resource_id=current.sub,
    )
    await db.commit()
    s = get_settings()
    return TokenResponse(
        access_token=token,
        expires_in=s.jwt_access_token_ttl_minutes * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> None:
    # Stateless JWT — client just discards the token.
    return None
