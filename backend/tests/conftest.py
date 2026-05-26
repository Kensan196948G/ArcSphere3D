"""Test fixtures — sets up a real Postgres DB for integration tests.

TestClient doesn't trigger FastAPI's lifespan unless used as a context
manager, so we call init_engine() here at import time so every route
handler can reach get_session() without raising RuntimeError.

RSA keypair is generated once at module import time and injected into
environment variables before get_settings() is first called, ensuring
that all tests within the session share the same keypair for sign/verify
consistency.
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import create_engine, text

# Generate and inject RSA keypair BEFORE any app module imports Settings.
_test_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_test_priv_pem = _test_private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.TraditionalOpenSSL,
    encryption_algorithm=serialization.NoEncryption(),
).decode()
_test_pub_pem = (
    _test_private_key.public_key()
    .public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    .decode()
)

os.environ["JWT_PRIVATE_KEY_PEM"] = _test_priv_pem
os.environ["JWT_PUBLIC_KEY_PEM"] = _test_pub_pem
os.environ["JWT_ALGORITHM"] = "RS256"

# Import app modules after env vars are set.
from app.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import init_engine  # noqa: E402

# Clear the lru_cache so Settings re-reads the env vars we just injected.
get_settings.cache_clear()

# Pin the security module's cached keypair to the test keypair so
# _get_or_generate_keys never generates a different ephemeral pair.
import app.security as _security_mod  # noqa: E402

_security_mod._cached_keys = (_test_priv_pem, _test_pub_pem)

# Initialise the app's async engine before any test function runs.
init_engine()


@pytest.fixture(scope="session", autouse=True)
def _db_schema() -> None:
    """Drop and recreate all tables once for the entire test session."""
    engine = create_engine(get_settings().database_url)
    # drop_all respects FK order when using sorted_tables, but CASCADE is safer
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    Base.metadata.create_all(engine)
    engine.dispose()


@pytest.fixture(autouse=True)
def _db_truncate(_db_schema: None) -> None:
    """Truncate all tables before each test so state does not bleed between tests."""
    engine = create_engine(get_settings().database_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE users, projects, files, alignments,"
                " alignment_ip_points, vertical_alignments, vertical_alignment_vips,"
                " project_members, audit_logs, user_notifications, tags, project_tags"
                " RESTART IDENTITY CASCADE"
            )
        )
    engine.dispose()


@pytest.fixture(autouse=True)
def _reset_rate_limiter() -> None:
    """Reset the login rate limiter before each test to prevent cross-test interference."""
    from app.routers.auth import _login_limiter

    _login_limiter.reset()


@pytest.fixture(autouse=True)
def _mock_s3() -> None:
    """Patch all S3 helpers where files router imported them — tests need no real S3."""
    presign_mock = AsyncMock(return_value="https://s3.example.com/presigned")
    with (
        patch("app.routers.files.put_object", new_callable=AsyncMock),
        patch("app.routers.files.delete_object", new_callable=AsyncMock),
        patch("app.routers.files.generate_presigned_url", presign_mock),
    ):
        yield
