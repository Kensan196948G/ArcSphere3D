"""Tests for audit log endpoint — Issue #129."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _admin_token() -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    return res.json()["access_token"]


def _viewer_token() -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    return res.json()["access_token"]


def test_audit_logs_requires_auth() -> None:
    res = client.get("/api/admin/audit-logs")
    assert res.status_code == 401


def test_audit_logs_requires_admin_role() -> None:
    token = _viewer_token()
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_audit_logs_accessible_to_admin() -> None:
    token = _admin_token()
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_login_creates_audit_log_entry() -> None:
    token = _admin_token()

    logs = client.get(
        "/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"}
    ).json()
    actions = [e["action"] for e in logs]
    assert "login_success" in actions


def test_failed_login_creates_audit_log_entry() -> None:
    client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "wrong-password-x"},
    )
    token = _admin_token()
    logs = client.get(
        "/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"}
    ).json()
    actions = [e["action"] for e in logs]
    assert "login_failure" in actions


def test_audit_logs_pagination() -> None:
    token = _admin_token()
    res = client.get(
        "/api/admin/audit-logs?skip=0&limit=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert len(res.json()) <= 1


def test_audit_log_schema_fields() -> None:
    token = _admin_token()
    logs = client.get(
        "/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"}
    ).json()
    assert len(logs) > 0
    entry = logs[0]
    for field in ("id", "action", "resource_type", "created_at"):
        assert field in entry
