"""FastAPI dependencies (current user, DB session, etc.)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas import CurrentUser
from app.security import decode_access_token

DbDep = Annotated[AsyncSession, Depends(get_session)]


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
    raw_sub = claims.get("sub")
    # Issue #180: every JWT 'sub' must be a UUID (the immutable user.id).
    # Rejecting non-UUID subs centrally here invalidates pre-migration tokens
    # (email subs) across every protected route, instead of relying on each
    # handler to remember the check.
    #
    # We also *normalize* the sub via `str(UUID(...))` rather than just
    # validating it: `UUID()` accepts several textual spellings of the same
    # value (uppercase, hyphen-less, urn:uuid: prefix), but `str(target.id)`
    # downstream always emits the canonical lowercase + hyphenated form. If
    # we stored the raw token string, an attacker could mint a token whose
    # `sub` was their own UUID in a non-canonical spelling, slip past the
    # admin self-guards (`str(target.id) == current.sub`), and self-delete
    # or self-demote — exactly the bypass surfaced by adversarial review.
    # `TypeError` covers non-string sub claims (null, int, array).
    try:
        if not isinstance(raw_sub, str):
            raise TypeError("sub must be a string")
        sub = str(UUID(raw_sub))
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token subject is not a user UUID; please re-authenticate",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return CurrentUser(
        sub=sub,
        email=claims.get("email"),
        role=claims.get("role", "viewer"),
    )


CurrentUserDep = Depends(get_current_user)
