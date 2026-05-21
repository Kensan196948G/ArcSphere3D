"""Auth endpoints — DB-backed local authentication + refresh token rotation.

Production readiness (Issue #128):
- Login verifies against DB users (bcrypt password_hash)
- Refresh token is an opaque 256-bit value stored as SHA-256 hash in DB
- Logout revokes the refresh token (DB row)
- OIDC/Entra ID callback stub (post-MVP)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from app.config import get_settings
from app.db import crud
from app.deps import DbDep
from app.ratelimit import SimpleRateLimiter
from app.schemas import (
    CurrentUser,
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from app.security import create_access_token, get_public_key_jwk

router = APIRouter(prefix="/api/auth", tags=["auth"])

_login_limiter = SimpleRateLimiter(max_calls=5, window_seconds=60)


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
async def login(request: Request, payload: LoginRequest, session: DbDep) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    if not _login_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too many login attempts — try again later",
            headers={"Retry-After": "60"},
        )

    user = await crud.authenticate_user_local(session, payload.email, payload.password)
    if user is None:
        await crud.log_audit(
            session,
            user_id=None,
            action="login_failure",
            resource_type="auth",
            ip_address=client_ip,
            detail=f"email={payload.email}",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )

    token = create_access_token(
        subject=user.sub,
        extra={"email": user.email, "role": user.role},
    )
    raw_refresh = await crud.create_refresh_token(session, user.id)

    await crud.log_audit(
        session,
        user_id=user.id,
        action="login_success",
        resource_type="auth",
        ip_address=client_ip,
    )

    s = get_settings()
    return TokenResponse(
        access_token=token,
        expires_in=s.jwt_access_token_ttl_minutes * 60,
        refresh_token=raw_refresh,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    responses={
        400: {"description": "malformed request body"},
        401: {"description": "invalid or expired refresh token"},
    },
)
async def refresh(payload: RefreshTokenRequest, session: DbDep) -> TokenResponse:
    """Issue a new access token by rotating the provided refresh token."""
    result = await crud.rotate_refresh_token(session, payload.refresh_token)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired refresh token",
        )
    user, new_raw = result
    token = create_access_token(
        subject=user.sub,
        extra={"email": user.email, "role": user.role},
    )
    s = get_settings()
    return TokenResponse(
        access_token=token,
        expires_in=s.jwt_access_token_ttl_minutes * 60,
        refresh_token=new_raw,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    session: DbDep,
    payload: LogoutRequest | None = None,
) -> None:
    """Revoke the refresh token so it cannot be used again."""
    if payload and payload.refresh_token:
        await crud.revoke_refresh_token(session, payload.refresh_token)
    return None


@router.get(
    "/oidc/callback",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    responses={501: {"description": "Entra ID SSO not yet configured — post-MVP"}},
    include_in_schema=True,
)
def oidc_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> dict[str, str]:
    """Microsoft Entra ID OIDC callback stub (post-MVP)."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Entra ID SSO is not yet configured. This endpoint will be activated post-MVP.",
    )


