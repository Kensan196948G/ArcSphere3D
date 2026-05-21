"""Tests for DB-backed authentication — Issue #128."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _login(email: str = "demo@arcsphere3d.dev", password: str = "arcsphere-demo") -> dict:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()


# ---- login ----


def test_login_returns_access_and_refresh_token() -> None:
    body = _login()
    assert body["token_type"] == "bearer"
    assert body["access_token"].count(".") == 2
    assert isinstance(body["refresh_token"], str)
    assert len(body["refresh_token"]) > 20


def test_login_wrong_password_returns_401() -> None:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "wrong-password-x"},
    )
    assert res.status_code == 401


def test_login_unknown_email_returns_401() -> None:
    res = client.post(
        "/api/auth/login",
        json={"email": "nobody@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 401


# ---- refresh token rotation ----


def test_refresh_token_issues_new_access_token() -> None:
    tokens = _login()
    res = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"].count(".") == 2
    assert isinstance(body["refresh_token"], str)


def test_refresh_token_rotates_on_each_use() -> None:
    tokens = _login()
    res1 = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    new_rt = res1.json()["refresh_token"]

    res2 = client.post("/api/auth/refresh", json={"refresh_token": new_rt})
    assert res2.status_code == 200
    assert res2.json()["refresh_token"] != new_rt


def test_refresh_token_cannot_be_reused_after_rotation() -> None:
    tokens = _login()
    old_rt = tokens["refresh_token"]
    client.post("/api/auth/refresh", json={"refresh_token": old_rt})

    # Reusing the old (rotated) refresh token must fail.
    res = client.post("/api/auth/refresh", json={"refresh_token": old_rt})
    assert res.status_code == 401


def test_refresh_with_invalid_token_returns_401() -> None:
    res = client.post("/api/auth/refresh", json={"refresh_token": "invalid-token"})
    assert res.status_code == 401


# ---- logout / revocation ----


def test_logout_revokes_refresh_token() -> None:
    tokens = _login()
    rt = tokens["refresh_token"]

    logout_res = client.post("/api/auth/logout", json={"refresh_token": rt})
    assert logout_res.status_code == 204

    # After logout, the refresh token must be invalid.
    refresh_res = client.post("/api/auth/refresh", json={"refresh_token": rt})
    assert refresh_res.status_code == 401


def test_logout_without_body_returns_204() -> None:
    res = client.post("/api/auth/logout")
    assert res.status_code == 204


# ---- OIDC stub ----


def test_oidc_callback_stub_returns_501() -> None:
    res = client.get("/api/auth/oidc/callback")
    assert res.status_code == 501
