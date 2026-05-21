"""Tests for PATCH /api/admin/users/{id}/role — admin updates user role."""

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


def test_admin_can_change_viewer_to_editor() -> None:
    admin_token = _login()
    viewer_token = _login(VIEWER_EMAIL)

    # Get viewer's user ID
    me_res = client.get("/api/users/me", headers=_auth(viewer_token))
    assert me_res.status_code == 200
    viewer_id = me_res.json()["id"]

    # Change role from viewer to editor
    res = client.patch(
        f"/api/admin/users/{viewer_id}/role",
        json={"role": "editor"},
        headers=_auth(admin_token),
    )
    assert res.status_code == 200
    assert res.json()["role"] == "editor"

    # Restore viewer role
    client.patch(
        f"/api/admin/users/{viewer_id}/role",
        json={"role": "viewer"},
        headers=_auth(admin_token),
    )


def test_admin_cannot_demote_themselves() -> None:
    admin_token = _login()
    me_res = client.get("/api/users/me", headers=_auth(admin_token))
    admin_id = me_res.json()["id"]

    res = client.patch(
        f"/api/admin/users/{admin_id}/role",
        json={"role": "viewer"},
        headers=_auth(admin_token),
    )
    assert res.status_code == 403
    assert "demote" in res.json()["detail"].lower()


def test_admin_can_change_own_role_to_admin() -> None:
    """Admin can PATCH their own role to admin (no-op but allowed)."""
    admin_token = _login()
    me_res = client.get("/api/users/me", headers=_auth(admin_token))
    admin_id = me_res.json()["id"]

    res = client.patch(
        f"/api/admin/users/{admin_id}/role",
        json={"role": "admin"},
        headers=_auth(admin_token),
    )
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


def test_non_admin_cannot_change_role() -> None:
    viewer_token = _login(VIEWER_EMAIL)
    fake_id = "00000000-0000-0000-0000-000000000000"
    res = client.patch(
        f"/api/admin/users/{fake_id}/role",
        json={"role": "editor"},
        headers=_auth(viewer_token),
    )
    assert res.status_code == 403


def test_update_role_unauthenticated() -> None:
    fake_id = "00000000-0000-0000-0000-000000000000"
    res = client.patch(f"/api/admin/users/{fake_id}/role", json={"role": "editor"})
    assert res.status_code == 401


def test_update_role_not_found() -> None:
    admin_token = _login()
    fake_id = "00000000-0000-0000-0000-000000000000"
    res = client.patch(
        f"/api/admin/users/{fake_id}/role",
        json={"role": "editor"},
        headers=_auth(admin_token),
    )
    assert res.status_code == 404


def test_update_role_audit_log() -> None:
    admin_token = _login()
    viewer_token = _login(VIEWER_EMAIL)
    me_res = client.get("/api/users/me", headers=_auth(viewer_token))
    viewer_id = me_res.json()["id"]

    client.patch(
        f"/api/admin/users/{viewer_id}/role",
        json={"role": "editor"},
        headers=_auth(admin_token),
    )

    audit = client.get(
        "/api/admin/audit-logs?action=user_role_changed",
        headers=_auth(admin_token),
    ).json()
    assert any(e["action"] == "user_role_changed" for e in audit)

    # Restore
    client.patch(
        f"/api/admin/users/{viewer_id}/role",
        json={"role": "viewer"},
        headers=_auth(admin_token),
    )
