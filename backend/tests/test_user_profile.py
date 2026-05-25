"""Tests for PATCH /api/users/me (profile editing)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_DEMO_EMAIL = "demo@arcsphere3d.dev"
_DEMO_PW = "arcsphere-demo"


def _login(email: str = _DEMO_EMAIL, password: str = _DEMO_PW) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---- password change --------------------------------------------------------


def test_patch_me_change_password_success() -> None:
    token = _login()
    res = client.patch(
        "/api/users/me",
        json={"current_password": _DEMO_PW, "new_password": "NewPass123!"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == _DEMO_EMAIL

    # verify new password works
    new_token = _login(password="NewPass123!")
    assert new_token


def test_patch_me_wrong_current_password() -> None:
    token = _login()
    res = client.patch(
        "/api/users/me",
        json={"current_password": "wrong-password!", "new_password": "NewPass456!"},
        headers=_auth(token),
    )
    assert res.status_code == 400
    assert "wrong current password" in res.json()["detail"]


def test_patch_me_new_password_without_current() -> None:
    token = _login()
    res = client.patch(
        "/api/users/me",
        json={"new_password": "NewPass789!"},
        headers=_auth(token),
    )
    assert res.status_code == 422


# ---- email change -----------------------------------------------------------


def test_patch_me_change_email_success() -> None:
    token = _login()
    res = client.patch(
        "/api/users/me",
        json={"email": "new-email@arcsphere3d.dev"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    assert res.json()["email"] == "new-email@arcsphere3d.dev"


def test_patch_me_duplicate_email_conflict() -> None:
    # Create second user
    admin_token = _login()
    client.post(
        "/api/admin/users",
        json={"email": "other@arcsphere3d.dev", "password": "OtherPass1!", "role": "viewer"},
        headers=_auth(admin_token),
    )
    # try to take the other user's email
    token = _login()
    res = client.patch(
        "/api/users/me",
        json={"email": "other@arcsphere3d.dev"},
        headers=_auth(token),
    )
    assert res.status_code == 409
    assert "already in use" in res.json()["detail"]


# ---- unauthenticated --------------------------------------------------------


def test_patch_me_requires_auth() -> None:
    res = client.patch("/api/users/me", json={"email": "x@arcsphere3d.dev"})
    assert res.status_code == 401


# ---- no-op patch (nothing changed) -----------------------------------------


def test_patch_me_noop() -> None:
    token = _login()
    res = client.patch("/api/users/me", json={}, headers=_auth(token))
    assert res.status_code == 200
    assert res.json()["email"] == _DEMO_EMAIL
