"""Tests for audit_logs — append-only model + admin endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.audit_log import AuditLog

client = TestClient(app)


# ---- helpers ----


def _admin_token() -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def _viewer_token() -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


# ---- audit log model: append-only enforcement ----


def test_audit_log_update_raises() -> None:
    """ORM 'before_update' event must raise RuntimeError."""
    row = AuditLog(action="test_event")
    with pytest.raises(RuntimeError, match="append-only"):
        # Simulate the event being fired by calling the listener directly.
        from app.models.audit_log import _block_update

        _block_update(None, None, row)


def test_audit_log_delete_raises() -> None:
    """ORM 'before_delete' event must raise RuntimeError."""
    row = AuditLog(action="test_event")
    with pytest.raises(RuntimeError, match="append-only"):
        from app.models.audit_log import _block_delete

        _block_delete(None, None, row)


# ---- GET /api/admin/audit-logs RBAC ----


def test_audit_logs_requires_auth() -> None:
    res = client.get("/api/admin/audit-logs")
    assert res.status_code == 401


def test_audit_logs_viewer_gets_403() -> None:
    token = _viewer_token()
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_audit_logs_admin_gets_200() -> None:
    token = _admin_token()
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_audit_logs_records_login_success() -> None:
    token = _admin_token()
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    logs = res.json()
    # The two logins above should have generated login_success entries.
    actions = [log["action"] for log in logs]
    assert "login_success" in actions


def test_audit_logs_records_login_failed() -> None:
    # Trigger a failed login.
    client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "wrong-password-x"},
    )
    token = _admin_token()
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    actions = [log["action"] for log in res.json()]
    assert "login_failed" in actions


def test_audit_logs_pagination() -> None:
    token = _admin_token()
    res = client.get(
        "/api/admin/audit-logs?skip=0&limit=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert len(res.json()) <= 1


def test_audit_logs_filter_by_action() -> None:
    token = _admin_token()
    res = client.get(
        "/api/admin/audit-logs?action=login_success",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    for log in res.json():
        assert log["action"] == "login_success"


def test_audit_logs_include_actor_email() -> None:
    token = _admin_token()
    res = client.get(
        "/api/admin/audit-logs?action=login_success",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) > 0
    assert "actor_email" in logs[0]
    emails = [log["actor_email"] for log in logs if log["actor_email"] is not None]
    assert any("arcsphere3d.dev" in e for e in emails)


def test_audit_logs_project_created() -> None:
    token = _admin_token()
    client.post(
        "/api/projects",
        json={"name": "Audit Test Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    res = client.get(
        "/api/admin/audit-logs?action=project_created",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    logs = res.json()
    assert any(log["action"] == "project_created" for log in logs)
    assert any(log["resource_type"] == "project" for log in logs)


def test_audit_logs_project_deleted() -> None:
    token = _admin_token()
    res = client.post(
        "/api/projects",
        json={"name": "Delete Audit Project"},
        headers={"Authorization": f"Bearer {token}"},
    )
    project_id = res.json()["id"]
    client.delete(
        f"/api/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    audit = client.get(
        "/api/admin/audit-logs?action=project_deleted",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert any(
        log["action"] == "project_deleted" and log["resource_id"] == project_id for log in audit
    )


def test_audit_logs_file_uploaded() -> None:
    token = _admin_token()
    res = client.post(
        "/api/projects",
        json={"name": "File Upload Audit"},
        headers={"Authorization": f"Bearer {token}"},
    )
    project_id = res.json()["id"]
    import io

    client.post(
        f"/api/files/upload?project_id={project_id}",
        files={"upload_file": ("model.stl", io.BytesIO(b"solid test\nendsolid"), "model/stl")},
        headers={"Authorization": f"Bearer {token}"},
    )
    audit = client.get(
        "/api/admin/audit-logs?action=file_uploaded",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert any(log["action"] == "file_uploaded" and log["resource_type"] == "file" for log in audit)


def test_audit_logs_file_deleted() -> None:
    token = _admin_token()
    res = client.post(
        "/api/projects",
        json={"name": "File Delete Audit"},
        headers={"Authorization": f"Bearer {token}"},
    )
    project_id = res.json()["id"]
    import io

    up = client.post(
        f"/api/files/upload?project_id={project_id}",
        files={"upload_file": ("del.stl", io.BytesIO(b"solid del\nendsolid"), "model/stl")},
        headers={"Authorization": f"Bearer {token}"},
    )
    file_id = up.json()["id"]
    client.delete(
        f"/api/files/{file_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    audit = client.get(
        "/api/admin/audit-logs?action=file_deleted",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert any(log["action"] == "file_deleted" and log["resource_id"] == file_id for log in audit)
