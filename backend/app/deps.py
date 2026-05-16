"""FastAPI dependencies (current user, etc.)."""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from app.schemas import CurrentUser
from app.security import decode_access_token


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return CurrentUser(
        sub=claims.get("sub", ""),
        email=claims.get("email"),
        role=claims.get("role", "viewer"),
    )


CurrentUserDep = Depends(get_current_user)
