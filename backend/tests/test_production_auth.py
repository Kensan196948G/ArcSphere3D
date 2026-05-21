"""Tests for DB-backed auth and OIDC scaffold (Issue #128)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_login_db_fallback_creates_user() -> None:
    """First login with demo credentials seeds the user into the DB."""
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 200
    assert res.json()["token_type"] == "bearer"


def test_login_db_fallback_second_call_uses_db() -> None:
    """Second login call reads from DB (password_hash is stored after first login)."""
    for _ in range(2):
        res = client.post(
            "/api/auth/login",
            json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
        )
        assert res.status_code == 200


def test_login_wrong_password_still_rejected() -> None:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "wrong-password-x"},
    )
    assert res.status_code == 401


def test_login_unknown_email_rejected() -> None:
    res = client.post(
        "/api/auth/login",
        json={"email": "unknown@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 401


def test_refresh_returns_new_token() -> None:
    login = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    token = login.json()["access_token"]
    res = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["token_type"] == "bearer"


def test_refresh_without_token_returns_401() -> None:
    res = client.post("/api/auth/refresh")
    assert res.status_code == 401


def test_oidc_callback_returns_pending() -> None:
    """OIDC callback stub returns 200 with pending status."""
    res = client.get("/api/auth/oidc/callback")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "pending"
    assert "Entra ID" in body["detail"]


def test_oidc_callback_with_params_returns_pending() -> None:
    """OIDC callback with real OIDC params returns 200 pending."""
    res = client.get("/api/auth/oidc/callback?code=abc&state=xyz")
    assert res.status_code == 200
    assert res.json()["status"] == "pending"
