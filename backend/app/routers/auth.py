"""Auth endpoints (MVP scaffold).

WARNING: This is a *scaffold*. The MVP demo user is configured in-memory
and must be replaced by a real user store + Entra ID SSO before production.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.schemas import CurrentUser, LoginRequest, TokenResponse
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

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


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        400: {"description": "malformed request body"},
        401: {"description": "invalid credentials"},
    },
)
def login(payload: LoginRequest) -> TokenResponse:
    user = _DEMO_USERS.get(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )
    token = create_access_token(
        subject=payload.email,
        extra={"email": payload.email, "role": user["role"]},
    )
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
def refresh(current: CurrentUser) -> TokenResponse:  # pragma: no cover - scaffold
    # TODO(post-MVP): rotate refresh tokens via httpOnly cookie.
    token = create_access_token(
        subject=current.sub,
        extra={"email": current.email, "role": current.role},
    )
    s = get_settings()
    return TokenResponse(
        access_token=token,
        expires_in=s.jwt_access_token_ttl_minutes * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> None:
    # Stateless JWT — client just discards the token.
    return None
