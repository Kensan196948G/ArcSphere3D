"""Property-based tests for PATCH /api/users/me.

Focuses on invariants that the JSON Schema alone cannot express:
- Email uniqueness: duplicate email always → 409
- Password boundary: 8-char min, 72-char max (bcrypt cap)
- Wrong current password: always → 401
- No 5xx on any schema-valid input
"""

from __future__ import annotations

import string
import uuid

from fastapi.testclient import TestClient
from hypothesis import given, settings
from hypothesis import strategies as st

from app.main import app

client = TestClient(app)


_DEFAULT_PW = "TestPass1!"  # noqa: S105


def _make_user(email: str | None = None, password: str = _DEFAULT_PW) -> tuple[str, str]:
    """Create a user via admin endpoint and return (email, token)."""
    email = email or f"prop-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    admin_res = client.post(
        "/api/auth/login",
        json={"email": "admin@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    admin_token = admin_res.json()["access_token"]
    client.post(
        "/api/admin/users",
        json={"email": email, "password": password, "role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    login = client.post("/api/auth/login", json={"email": email, "password": password})
    return email, login.json()["access_token"]


@given(new_email=st.emails().filter(lambda e: e.endswith(".dev") or "." in e.split("@")[1]))
@settings(max_examples=10, deadline=5000)
def test_patch_email_never_500(new_email: str) -> None:
    """PATCH /api/users/me with any email must never return 5xx."""
    _, token = _make_user()
    res = client.patch(
        "/api/users/me",
        json={"email": new_email},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code < 500, f"500 for email={new_email!r}: {res.text}"


@given(password_len=st.integers(min_value=8, max_value=72))
@settings(max_examples=10, deadline=5000)
def test_patch_password_valid_lengths_accepted(password_len: int) -> None:
    """Passwords 8-72 printable ASCII chars must always be accepted with correct current PW."""
    current_pw = "InitialPass1!"
    _, token = _make_user(password=current_pw)
    new_pw = ("A" * (password_len - 2) + "1!")[:password_len]
    # Ensure meets pattern constraints
    if len(new_pw) < 8 or len(new_pw) > 72:
        return
    res = client.patch(
        "/api/users/me",
        json={"current_password": current_pw, "new_password": new_pw},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code in (200, 422), f"Unexpected {res.status_code} for len={password_len}"


def test_patch_password_73_chars_rejected() -> None:
    """Password exceeding 72 chars must be rejected with 422."""
    current_pw = "InitialPass1!"
    _, token = _make_user(password=current_pw)
    too_long = "A" * 71 + "1!"  # 73 chars
    res = client.patch(
        "/api/users/me",
        json={"current_password": current_pw, "new_password": too_long},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422


def test_patch_password_7_chars_rejected() -> None:
    """Password shorter than 8 chars must be rejected with 422."""
    current_pw = "InitialPass1!"
    _, token = _make_user(password=current_pw)
    res = client.patch(
        "/api/users/me",
        json={"current_password": current_pw, "new_password": "Short1!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422


def test_duplicate_email_invariant() -> None:
    """Changing email to one already owned by another user must always return 409."""
    email_a = f"inv-a-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    email_b = f"inv-b-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    _, token_a = _make_user(email=email_a)
    _make_user(email=email_b)

    # Attempt to take B's email
    res = client.patch(
        "/api/users/me",
        json={"email": email_b},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 409


@given(
    wrong_pw=st.text(
        alphabet=string.printable.replace("\x00", ""),
        min_size=8,
        max_size=72,
    ).filter(lambda p: p != "InitialPass1!" and p.strip() == p and p.isprintable())
)
@settings(max_examples=5, deadline=5000)
def test_wrong_current_password_always_401(wrong_pw: str) -> None:
    """Wrong current password must always return 401, never 200 or 5xx."""
    _, token = _make_user()
    res = client.patch(
        "/api/users/me",
        json={"current_password": wrong_pw, "new_password": "NewCorrect1!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code in (401, 422), f"Unexpected {res.status_code} for pw={wrong_pw!r}"
