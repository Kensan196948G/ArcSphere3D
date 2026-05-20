"""Integration tests for the users API (/api/users/me and /api/users/lookup)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

DEMO_CREDS = {"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"}
OTHER_CREDS = {"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"}


def _login(creds: dict[str, str]) -> str:
    res = client.post("/api/auth/login", json=creds)
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---- /me ----------------------------------------------------------------


def test_get_me_unauthenticated() -> None:
    res = client.get("/api/users/me")
    assert res.status_code == 401


def test_get_me_returns_user_info() -> None:
    token = _login(DEMO_CREDS)
    res = client.get("/api/users/me", headers=_auth(token))
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "demo@arcsphere3d.dev"
    assert "id" in data
    assert "sub" in data
    assert "role" in data


# ---- /lookup ------------------------------------------------------------


def test_lookup_unauthenticated() -> None:
    res = client.get("/api/users/lookup?email=demo@arcsphere3d.dev")
    assert res.status_code == 401


def test_lookup_existing_user() -> None:
    # Ensure users exist in DB via /me (triggers upsert_user)
    demo_token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    client.get("/api/users/me", headers=_auth(demo_token))  # upsert demo
    client.get("/api/users/me", headers=_auth(other_token))  # upsert other

    # other user looks up demo by email
    res = client.get(
        "/api/users/lookup?email=demo@arcsphere3d.dev",
        headers=_auth(other_token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "demo@arcsphere3d.dev"
    assert "id" in data
    # response must NOT leak sensitive fields
    assert "password" not in data
    assert "sub" not in data
    assert "role" not in data

    # demo user can also look themselves up
    res2 = client.get(
        "/api/users/lookup?email=demo@arcsphere3d.dev",
        headers=_auth(demo_token),
    )
    assert res2.status_code == 200
    assert res2.json()["id"] == data["id"]


def test_lookup_nonexistent_user() -> None:
    token = _login(DEMO_CREDS)
    res = client.get(
        "/api/users/lookup?email=nobody@arcsphere3d.dev",
        headers=_auth(token),
    )
    assert res.status_code == 404


def test_lookup_invalid_email() -> None:
    token = _login(DEMO_CREDS)
    res = client.get(
        "/api/users/lookup?email=not-an-email",
        headers=_auth(token),
    )
    # FastAPI validates EmailStr query param → 422
    assert res.status_code == 422
