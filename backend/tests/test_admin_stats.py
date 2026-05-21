"""Tests for GET /api/admin/stats — admin dashboard statistics."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

DEMO_EMAIL = "demo@arcsphere3d.dev"
DEMO_PASSWORD = "arcsphere-demo"
OTHER_EMAIL = "other@arcsphere3d.dev"


def _login(email: str = DEMO_EMAIL, password: str = DEMO_PASSWORD) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_admin_stats_returns_counts() -> None:
    token = _login()
    res = client.get("/api/admin/stats", headers=_auth(token))
    assert res.status_code == 200
    data = res.json()
    assert "total_users" in data
    assert "total_projects" in data
    assert "total_files" in data
    assert "total_audit_events" in data
    assert isinstance(data["total_users"], int)
    assert data["total_users"] >= 1  # at least the demo user


def test_admin_stats_non_admin_forbidden() -> None:
    token = _login(OTHER_EMAIL)
    res = client.get("/api/admin/stats", headers=_auth(token))
    assert res.status_code == 403


def test_admin_stats_unauthenticated() -> None:
    res = client.get("/api/admin/stats")
    assert res.status_code == 401


def test_admin_stats_reflects_created_project() -> None:
    token = _login()
    # Get baseline
    baseline = client.get("/api/admin/stats", headers=_auth(token)).json()

    # Create a project
    create_res = client.post(
        "/api/projects",
        json={"name": "stats-test-proj"},
        headers=_auth(token),
    )
    assert create_res.status_code == 201
    proj_id = create_res.json()["id"]

    # Stats should reflect the new project
    after = client.get("/api/admin/stats", headers=_auth(token)).json()
    assert after["total_projects"] == baseline["total_projects"] + 1

    # Cleanup
    client.delete(f"/api/projects/{proj_id}", headers=_auth(token))
