"""Tests for POST /api/admin/users — admin creates a new user."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ADMIN_EMAIL = "demo@arcsphere3d.dev"
ADMIN_PASSWORD = "arcsphere-demo"
VIEWER_EMAIL = "other@arcsphere3d.dev"


def _login(email: str = ADMIN_EMAIL, password: str = ADMIN_PASSWORD) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_admin_can_create_user() -> None:
    token = _login()
    res = client.post(
        "/api/admin/users",
        json={"email": "newuser@arcsphere3d.dev", "password": "newpass-123", "role": "viewer"},
        headers=_auth(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "newuser@arcsphere3d.dev"
    assert data["role"] == "viewer"
    assert "id" in data


def test_admin_create_user_with_editor_role() -> None:
    token = _login()
    res = client.post(
        "/api/admin/users",
        json={"email": "editor@arcsphere3d.dev", "password": "editor-pw-456", "role": "editor"},
        headers=_auth(token),
    )
    assert res.status_code == 201
    assert res.json()["role"] == "editor"


def test_admin_create_user_duplicate_email_returns_409() -> None:
    token = _login()
    # First creation succeeds
    client.post(
        "/api/admin/users",
        json={"email": "dup@arcsphere3d.dev", "password": "pass-word-1", "role": "viewer"},
        headers=_auth(token),
    )
    # Second with same email fails
    res = client.post(
        "/api/admin/users",
        json={"email": "dup@arcsphere3d.dev", "password": "other-pass-2", "role": "viewer"},
        headers=_auth(token),
    )
    assert res.status_code == 409
    assert "email" in res.json()["detail"].lower()


def test_admin_create_user_non_admin_gets_403() -> None:
    token = _login(VIEWER_EMAIL)
    res = client.post(
        "/api/admin/users",
        json={"email": "nobody@arcsphere3d.dev", "password": "pass-1234", "role": "viewer"},
        headers=_auth(token),
    )
    assert res.status_code == 403


def test_admin_create_user_unauthenticated_gets_401() -> None:
    res = client.post(
        "/api/admin/users",
        json={"email": "nobody@arcsphere3d.dev", "password": "pass-1234", "role": "viewer"},
    )
    assert res.status_code == 401


def test_admin_create_user_can_login_immediately() -> None:
    admin_token = _login()
    new_email = "logintest@arcsphere3d.dev"
    new_password = "login-pw-789"
    res = client.post(
        "/api/admin/users",
        json={"email": new_email, "password": new_password, "role": "viewer"},
        headers=_auth(admin_token),
    )
    assert res.status_code == 201

    # New user can immediately login
    login_res = client.post(
        "/api/auth/login",
        json={"email": new_email, "password": new_password},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_admin_create_user_audit_log() -> None:
    token = _login()
    res = client.post(
        "/api/admin/users",
        json={"email": "auditcheck@arcsphere3d.dev", "password": "audit-pw-111", "role": "viewer"},
        headers=_auth(token),
    )
    assert res.status_code == 201

    audit = client.get(
        "/api/admin/audit-logs?action=user_created",
        headers=_auth(token),
    ).json()
    assert any(e["action"] == "user_created" for e in audit)
