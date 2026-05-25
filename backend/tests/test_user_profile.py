"""Tests for PATCH /api/users/me (profile edit: email + password)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_EMAIL = f"profile-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
_PW = "InitialPass1!"
_NEW_EMAIL = f"profile-new-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
_NEW_PW = "NewPassword2@"


def _register(email: str = _EMAIL, password: str = _PW) -> str:
    """Create a user via admin endpoint and return token."""
    admin_login = client.post(
        "/api/auth/login",
        json={"email": "admin@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    admin_token = admin_login.json()["access_token"]
    client.post(
        "/api/admin/users",
        json={"email": email, "password": password, "role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]


def test_patch_me_change_email() -> None:
    email = f"patch-email-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    new_email = f"patch-email-new-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    token = _register(email=email)

    res = client.patch(
        "/api/users/me",
        json={"email": new_email},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["email"] == new_email


def test_patch_me_change_password() -> None:
    email = f"patch-pw-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    pw = "OldPass123!"
    new_pw = "NewPass456@"
    token = _register(email=email, password=pw)

    res = client.patch(
        "/api/users/me",
        json={"current_password": pw, "new_password": new_pw},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200

    # Can login with new password
    login = client.post("/api/auth/login", json={"email": email, "password": new_pw})
    assert login.status_code == 200


def test_patch_me_wrong_current_password() -> None:
    email = f"patch-wrong-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    token = _register(email=email)

    res = client.patch(
        "/api/users/me",
        json={"current_password": "WrongPass999!", "new_password": "NewPass456@"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401


def test_patch_me_duplicate_email() -> None:
    email_a = f"patch-dup-a-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    email_b = f"patch-dup-b-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    token_a = _register(email=email_a)
    _register(email=email_b)

    # Try to change A's email to B's email — should conflict
    res = client.patch(
        "/api/users/me",
        json={"email": email_b},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 409


def test_patch_me_requires_auth() -> None:
    res = client.patch("/api/users/me", json={"email": "someone@example.com"})
    assert res.status_code == 401


def test_patch_me_new_password_without_current_password_rejected() -> None:
    email = f"patch-nopw-{uuid.uuid4().hex[:8]}@arcsphere3d.dev"
    token = _register(email=email)

    res = client.patch(
        "/api/users/me",
        json={"new_password": "NewPass456@"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422
