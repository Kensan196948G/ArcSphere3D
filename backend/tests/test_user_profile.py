"""Integration tests for PATCH /api/users/me (user profile editing)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ADMIN_CREDS = {"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"}
USER_CREDS = {"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"}


def _login(creds: dict[str, str]) -> str:
    res = client.post("/api/auth/login", json=creds)
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _get_user_token() -> str:
    """Ensure the viewer user exists and return a token for it."""
    admin_token = _login(ADMIN_CREDS)
    client.post(
        "/api/admin/users",
        json=USER_CREDS | {"role": "viewer"},
        headers=_auth(admin_token),
    )
    return _login(USER_CREDS)


# ---- PATCH /api/users/me ------------------------------------------------


def test_patch_me_unauthenticated() -> None:
    res = client.patch("/api/users/me", json={"email": "new@arcsphere3d.dev"})
    assert res.status_code == 401


def test_patch_me_change_email() -> None:
    token = _get_user_token()
    res = client.patch(
        "/api/users/me",
        json={"email": "changed@arcsphere3d.dev"},
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["email"] == "changed@arcsphere3d.dev"


def test_patch_me_email_duplicate_rejected() -> None:
    token = _get_user_token()
    # demo@arcsphere3d.dev already exists (admin seed user)
    res = client.patch(
        "/api/users/me",
        json={"email": "demo@arcsphere3d.dev"},
        headers=_auth(token),
    )
    assert res.status_code == 409


def test_patch_me_change_password_correct_current() -> None:
    token = _get_user_token()
    res = client.patch(
        "/api/users/me",
        json={"current_password": "arcsphere-demo", "new_password": "new-p@ssw0rd"},
        headers=_auth(token),
    )
    assert res.status_code == 200, res.text
    # Should be able to log in with the new password now
    new_token_res = client.post(
        "/api/auth/login",
        json={"email": USER_CREDS["email"], "password": "new-p@ssw0rd"},
    )
    assert new_token_res.status_code == 200


def test_patch_me_change_password_wrong_current() -> None:
    token = _get_user_token()
    res = client.patch(
        "/api/users/me",
        json={"current_password": "wrong-password", "new_password": "new-p@ssw0rd"},
        headers=_auth(token),
    )
    assert res.status_code == 400


def test_patch_me_new_password_without_current_password() -> None:
    token = _get_user_token()
    res = client.patch(
        "/api/users/me",
        json={"new_password": "new-p@ssw0rd"},
        headers=_auth(token),
    )
    assert res.status_code == 422


def test_patch_me_no_changes_is_noop() -> None:
    token = _get_user_token()
    me_before = client.get("/api/users/me", headers=_auth(token)).json()
    res = client.patch("/api/users/me", json={}, headers=_auth(token))
    assert res.status_code == 200
    assert res.json()["email"] == me_before["email"]
