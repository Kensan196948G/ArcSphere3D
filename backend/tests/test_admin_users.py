"""Tests for GET/DELETE /api/admin/users — admin user management (Issue #138)."""

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


def test_list_users_admin_can_access() -> None:
    token = _login()
    res = client.get("/api/admin/users", headers=_auth(token))
    assert res.status_code == 200
    users = res.json()
    assert isinstance(users, list)
    assert any(u["email"] == DEMO_EMAIL for u in users)


def test_list_users_non_admin_gets_403() -> None:
    token = _login(OTHER_EMAIL)
    res = client.get("/api/admin/users", headers=_auth(token))
    assert res.status_code == 403


def test_list_users_unauthenticated_gets_401() -> None:
    res = client.get("/api/admin/users")
    assert res.status_code == 401


def test_list_users_pagination() -> None:
    token = _login()
    res = client.get("/api/admin/users?skip=0&limit=1", headers=_auth(token))
    assert res.status_code == 200
    assert len(res.json()) <= 1


def test_delete_user_self_deletion_forbidden() -> None:
    """Admin cannot delete themselves."""
    token = _login()
    me = client.get("/api/admin/users", headers=_auth(token)).json()
    my_id = next(u["id"] for u in me if u["email"] == DEMO_EMAIL)
    res = client.delete(f"/api/admin/users/{my_id}", headers=_auth(token))
    assert res.status_code == 403
    assert "own account" in res.json()["detail"]


def test_delete_user_not_found() -> None:
    token = _login()
    fake_id = "00000000-0000-0000-0000-000000000000"
    res = client.delete(f"/api/admin/users/{fake_id}", headers=_auth(token))
    assert res.status_code == 404


def test_delete_user_non_admin_gets_403() -> None:
    token = _login(OTHER_EMAIL)
    fake_id = "00000000-0000-0000-0000-000000000001"
    res = client.delete(f"/api/admin/users/{fake_id}", headers=_auth(token))
    assert res.status_code == 403


def test_delete_user_success_and_audit_log() -> None:
    """Create a user via login, delete it, verify audit log."""
    # Seed the "other" user by logging in
    _login(OTHER_EMAIL)

    admin_token = _login()
    users = client.get("/api/admin/users", headers=_auth(admin_token)).json()
    other = next((u for u in users if u["email"] == OTHER_EMAIL), None)
    assert other is not None

    res = client.delete(f"/api/admin/users/{other['id']}", headers=_auth(admin_token))
    assert res.status_code == 204

    # User should no longer appear in list
    users_after = client.get("/api/admin/users", headers=_auth(admin_token)).json()
    assert not any(u["email"] == OTHER_EMAIL for u in users_after)

    # Audit log should record user_deleted
    audit = client.get(
        "/api/admin/audit-logs?action=user_deleted",
        headers=_auth(admin_token),
    ).json()
    assert any(e["action"] == "user_deleted" for e in audit)
