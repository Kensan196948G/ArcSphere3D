"""Password hashing + JWT signing/verification helpers.

RS256 asymmetric keypair is used for JWT. In dev/test environments where
JWT_PRIVATE_KEY_PEM / JWT_PUBLIC_KEY_PEM are not set, an ephemeral RSA keypair
is generated once per process and cached for the lifetime of that process.

Bcrypt has a 72-byte input cap; we truncate at the byte level before hashing
so longer passwords are still accepted (and verified consistently).
"""

from __future__ import annotations

import base64 as _base64
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey as _RSAPublicKey
from jose import JWTError, jwt

from app.config import get_settings

_BCRYPT_MAX_BYTES = 72

# Module-level cache so the same process always uses the same ephemeral keypair.
# conftest.py overwrites this directly to inject the test keypair before imports.
_cached_keys: tuple[str, str] | None = None


def _get_or_generate_keys(settings: Any) -> tuple[str, str]:
    """Return (private_pem, public_pem).

    If Settings already has PEMs configured, use them directly.
    Otherwise (dev/test only) generate an ephemeral RSA-2048 keypair once and
    cache it at module level so every call within the same process returns the
    same pair — this keeps token sign/verify consistent across tests.
    """
    global _cached_keys  # noqa: PLW0603

    if settings.jwt_private_key_pem and settings.jwt_public_key_pem:
        return settings.jwt_private_key_pem, settings.jwt_public_key_pem

    if _cached_keys is not None:
        return _cached_keys

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    pub_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    _cached_keys = (priv_pem, pub_pem)
    return _cached_keys


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
    priv_pem, _ = _get_or_generate_keys(settings)
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_access_token_ttl_minutes)).timestamp()),
        "iss": settings.app_name,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, priv_pem, algorithm="RS256")


def _int_to_base64url(n: int) -> str:
    byte_len = (n.bit_length() + 7) // 8
    return _base64.urlsafe_b64encode(n.to_bytes(byte_len, "big")).rstrip(b"=").decode()


def get_public_key_jwk() -> dict[str, Any]:
    """Return the RSA public key as a JWK (RFC 7517) dict for JWKS endpoint."""
    settings = get_settings()
    _, pub_pem = _get_or_generate_keys(settings)
    raw = serialization.load_pem_public_key(pub_pem.encode())
    if not isinstance(raw, _RSAPublicKey):
        raise TypeError("Expected RSA public key")
    nums = raw.public_numbers()
    return {
        "kty": "RSA",
        "use": "sig",
        "kid": "default",
        "alg": "RS256",
        "n": _int_to_base64url(nums.n),
        "e": _int_to_base64url(nums.e),
    }


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    _, pub_pem = _get_or_generate_keys(settings)
    try:
        return jwt.decode(
            token,
            pub_pem,
            algorithms=["RS256"],
            issuer=settings.app_name,
            options={"require": ["exp", "sub", "iss"]},
        )
    except JWTError as exc:
        raise ValueError(f"invalid token: {exc}") from exc
