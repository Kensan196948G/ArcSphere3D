"""Password hashing + JWT signing/verification helpers.

NOTE: MVP uses HS256 JWT with a shared secret. Production should migrate to
RS256 with a managed KMS-backed private key.

Bcrypt has a 72-byte input cap; we truncate at the byte level before hashing
so longer passwords are still accepted (and verified consistently).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

_BCRYPT_MAX_BYTES = 72


def _prep(plain: str) -> bytes:
    return plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(plain: str) -> str:
    # Reject (rather than silently truncate) passwords whose UTF-8 byte length
    # exceeds bcrypt's 72-byte cap — otherwise two distinct passwords sharing
    # the same first-72-byte prefix would hash identically and authenticate
    # interchangeably.
    if len(plain.encode("utf-8")) > _BCRYPT_MAX_BYTES:
        raise ValueError(
            f"password exceeds bcrypt's {_BCRYPT_MAX_BYTES}-byte cap; "
            "shorten it or pre-hash via SHA-256 before bcrypt"
        )
    return bcrypt.hashpw(_prep(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prep(plain), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_access_token_ttl_minutes)).timestamp()),
        "iss": settings.app_name,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.app_name,
            options={"require": ["exp", "sub", "iss"]},
        )
    except JWTError as exc:
        raise ValueError(f"invalid token: {exc}") from exc
