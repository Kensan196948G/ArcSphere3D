"""Tests for PATCH /api/users/me — email + password update."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_ADMIN_EMAIL = "demo@arcsphere3d.dev"
_ADMIN_PASSWORD = "arcsphere-demo"
_USER_EMAIL = "profiletest@arcsphere3d.dev"
_USER_PASSWORD = "Profile-Test-9!"
_NEW_PASSWORD = "NewProfile-T9!"
_NEW_EMAIL = "profiletest2@arcsphere3d.dev"


def _admin_token() -> str:
    res = client.post("/api/auth/login", json={"email": _ADMIN_EMAIL, "password": _ADMIN_PASSWORD})
    assert res.status_code == 200
    return res.json()["access_token"]


def _create_and_login_user(email: str = _USER_EMAIL, password: str = _USER_PASSWORD) -> str:
    admin = _admin_token()
    client.post(
        "/api/admin/users",
        json={"email": email, "password": password, "role": "viewer"},
        headers={"Authorization": f"Bearer {admin}"},
    )
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_patch_me_no_fields_returns_400() -> None:
    token = _create_and_login_user()
    res = client.patch("/api/users/me", json={}, headers=_auth(token))
    assert res.status_code == 400


def test_patch_me_requires_current_password_for_email_change() -> None:
    token = _create_and_login_user()
    res = client.patch(
        "/api/users/me",
        json={"email": _NEW_EMAIL},
        headers=_auth(token),
    )
    assert res.status_code == 400
    assert "current_password" in res.json()["detail"]


def test_patch_me_wrong_current_password_returns_401() -> None:
    token = _create_and_login_user()
    res = client.patch(
        "/api/users/me",
        json={"email": _NEW_EMAIL, "current_password": "wrong-password!"},
        headers=_auth(token),
    )
    assert res.status_code == 401


def test_patch_me_change_email_success() -> None:
    token = _create_and_login_user()
    res = client.patch(
        "/api/users/me",
        json={"email": _NEW_EMAIL, "current_password": _USER_PASSWORD},
        headers=_auth(token),
    )
    assert res.status_code == 200
    assert res.json()["email"] == _NEW_EMAIL


def test_patch_me_change_password_success() -> None:
    token = _create_and_login_user()
    res = client.patch(
        "/api/users/me",
        json={"new_password": _NEW_PASSWORD, "current_password": _USER_PASSWORD},
        headers=_auth(token),
    )
    assert res.status_code == 200

    # Verify new password works
    login = client.post("/api/auth/login", json={"email": _USER_EMAIL, "password": _NEW_PASSWORD})
    assert login.status_code == 200


def test_patch_me_duplicate_email_returns_409() -> None:
    admin = _admin_token()
    other_email = "other-profile@arcsphere3d.dev"
    client.post(
        "/api/admin/users",
        json={"email": other_email, "password": _USER_PASSWORD, "role": "viewer"},
        headers={"Authorization": f"Bearer {admin}"},
    )
    token = _create_and_login_user()
    res = client.patch(
        "/api/users/me",
        json={"email": other_email, "current_password": _USER_PASSWORD},
        headers=_auth(token),
    )
    assert res.status_code == 409


def test_patch_me_unauthenticated_returns_401() -> None:
    res = client.patch(
        "/api/users/me",
        json={"email": _NEW_EMAIL, "current_password": _USER_PASSWORD},
    )
    assert res.status_code == 401
