"""Tests for POST /api/admin/users/{id}/reset-password."""

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


def _create_target_user(admin_token: str) -> str:
    res = client.post(
        "/api/admin/users",
        json={"email": "reset-target@arcsphere3d.dev", "password": "original-pw-1", "role": "viewer"},  # noqa: E501
        headers=_auth(admin_token),
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_admin_can_reset_password() -> None:
    admin = _login()
    uid = _create_target_user(admin)
    res = client.post(
        f"/api/admin/users/{uid}/reset-password",
        json={"new_password": "new-secure-pw-1"},
        headers=_auth(admin),
    )
    assert res.status_code == 204


def test_reset_password_allows_login_with_new_password() -> None:
    admin = _login()
    uid = _create_target_user(admin)
    client.post(
        f"/api/admin/users/{uid}/reset-password",
        json={"new_password": "updated-pw-2"},
        headers=_auth(admin),
    )
    res = client.post(
        "/api/auth/login",
        json={"email": "reset-target@arcsphere3d.dev", "password": "updated-pw-2"},
    )
    assert res.status_code == 200


def test_reset_password_non_admin_returns_403() -> None:
    admin = _login()
    uid = _create_target_user(admin)
    viewer = _login(VIEWER_EMAIL)
    res = client.post(
        f"/api/admin/users/{uid}/reset-password",
        json={"new_password": "hacker-pw-!"},
        headers=_auth(viewer),
    )
    assert res.status_code == 403


def test_reset_password_unauthenticated_returns_401() -> None:
    admin = _login()
    uid = _create_target_user(admin)
    res = client.post(
        f"/api/admin/users/{uid}/reset-password",
        json={"new_password": "no-auth-pw-!"},
    )
    assert res.status_code == 401


def test_reset_password_nonexistent_user_returns_404() -> None:
    admin = _login()
    res = client.post(
        "/api/admin/users/00000000-0000-0000-0000-000000000000/reset-password",
        json={"new_password": "ghost-pw-1234"},
        headers=_auth(admin),
    )
    assert res.status_code == 404


def test_reset_password_too_short_returns_422() -> None:
    admin = _login()
    uid = _create_target_user(admin)
    res = client.post(
        f"/api/admin/users/{uid}/reset-password",
        json={"new_password": "short"},
        headers=_auth(admin),
    )
    assert res.status_code in (400, 422)


def test_reset_password_logged_in_audit() -> None:
    admin = _login()
    uid = _create_target_user(admin)
    client.post(
        f"/api/admin/users/{uid}/reset-password",
        json={"new_password": "audit-check-pw1"},
        headers=_auth(admin),
    )
    logs_res = client.get(
        "/api/admin/audit-logs?action=password_reset_by_admin",
        headers=_auth(admin),
    )
    assert logs_res.status_code == 200
    logs = logs_res.json()
    matching = [log for log in logs if log["resource_id"] == uid]
    assert len(matching) >= 1
