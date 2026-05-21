"""Auth endpoints.

Login flow: DB users take priority; in-memory _DEMO_USERS act as a fallback
during the MVP phase and will be removed when the user admin UI ships.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.config import get_settings
from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.ratelimit import SimpleRateLimiter
from app.schemas import CurrentUser, LoginRequest, PasswordChangeRequest, TokenResponse
from app.security import create_access_token, get_public_key_jwk, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 5 attempts per 60 seconds per client IP — brute-force mitigation.
_login_limiter = SimpleRateLimiter(max_calls=5, window_seconds=60)

# MVP fallback — DB users take priority. Removed when user admin UI ships.
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

    # DB-first lookup — seeds the DB user on first login if it's a known demo user.
    db_user = await crud.get_user_by_email(db, payload.email)
    if db_user is not None and db_user.password_hash:
        authenticated = verify_password(payload.password, db_user.password_hash)
        role = db_user.role
    else:
        # Fallback: check in-memory demo users and persist to DB on success.
        demo = _DEMO_USERS.get(payload.email)
        if demo and verify_password(payload.password, demo["password_hash"]):
            db_user = await crud.get_or_create_db_user(
                db,
                email=payload.email,
                password_hash=demo["password_hash"],
                role=demo["role"],
            )
            authenticated = True
            role = db_user.role
        else:
            authenticated = False
            role = "viewer"

    if not authenticated:
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
        extra={"email": payload.email, "role": role},
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


@router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        400: {"description": "new password too short or malformed"},
        401: {"description": "missing or invalid token, or wrong current password"},
        404: {"description": "user not found in DB (demo-only user)"},
    },
)
async def change_password(
    payload: PasswordChangeRequest,
    db: DbDep,
    current: CurrentUser = CurrentUserDep,
) -> None:
    """Change the authenticated user's password after verifying the current one."""
    db_user = await crud.get_user_by_email(db, current.sub)
    if db_user is None or not db_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user has no DB password — cannot change password for SSO-only accounts",
        )
    if not verify_password(payload.current_password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="current password is incorrect",
        )
    new_hash = hash_password(payload.new_password)
    await crud.update_user_password(db, user_id=db_user.id, new_password_hash=new_hash)
    await crud.log_audit_event(
        db,
        action="password_changed",
        user_id=db_user.id,
        resource_type="user",
        resource_id=str(db_user.id),
    )
    await db.commit()


# ---- Entra ID / OIDC scaffold ----


class _OidcStatus(BaseModel):
    status: str
    detail: str


@router.get(
    "/oidc/callback",
    response_model=_OidcStatus,
    responses={200: {"description": "OIDC callback stub — Entra ID SSO not yet configured"}},
    tags=["auth"],
)
def oidc_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> _OidcStatus:
    """OIDC authorization-code callback from Entra ID (post-MVP placeholder)."""
    return _OidcStatus(
        status="pending",
        detail="Entra ID SSO is not yet configured — post-MVP feature",
    )
