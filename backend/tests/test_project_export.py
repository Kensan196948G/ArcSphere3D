"""Tests for GET /api/projects/{project_id}/export (ZIP download)."""

from __future__ import annotations

import io
import zipfile
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_ADMIN_CREDS = {"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"}
_OTHER_CREDS = {"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"}


def _token(creds: dict[str, str]) -> str:
    res = client.post("/api/auth/login", json=creds)
    assert res.status_code == 200
    return res.json()["access_token"]


def _create_project(token: str, name: str = "Export Test") -> str:
    res = client.post(
        "/api/projects",
        json={"name": name},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    return res.json()["id"]


def _upload_file(token: str, project_id: str, filename: str = "model.stl") -> str:
    res = client.post(
        f"/api/files/upload?project_id={project_id}",
        files={"upload_file": (filename, io.BytesIO(b"solid test\nendsolid"), "model/stl")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_export_requires_auth() -> None:
    token = _token(_ADMIN_CREDS)
    project_id = _create_project(token)
    res = client.get(f"/api/projects/{project_id}/export")
    assert res.status_code == 401


def test_export_nonmember_gets_404() -> None:
    admin_token = _token(_ADMIN_CREDS)
    other_token = _token(_OTHER_CREDS)
    project_id = _create_project(admin_token)
    res = client.get(
        f"/api/projects/{project_id}/export",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res.status_code == 404


def test_export_owner_gets_200() -> None:
    token = _token(_ADMIN_CREDS)
    project_id = _create_project(token)
    with patch("app.routers.projects.get_object", new_callable=AsyncMock, return_value=b"data"):
        res = client.get(
            f"/api/projects/{project_id}/export",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200


def test_export_returns_zip_content_type() -> None:
    token = _token(_ADMIN_CREDS)
    project_id = _create_project(token)
    with patch("app.routers.projects.get_object", new_callable=AsyncMock, return_value=b"data"):
        res = client.get(
            f"/api/projects/{project_id}/export",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200
    assert "application/zip" in res.headers.get("content-type", "")


def test_export_empty_project_returns_empty_zip() -> None:
    token = _token(_ADMIN_CREDS)
    project_id = _create_project(token)
    with patch("app.routers.projects.get_object", new_callable=AsyncMock, return_value=b"data"):
        res = client.get(
            f"/api/projects/{project_id}/export",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200
    zf = zipfile.ZipFile(io.BytesIO(res.content))
    assert zf.namelist() == []


def test_export_zip_contains_uploaded_files() -> None:
    token = _token(_ADMIN_CREDS)
    project_id = _create_project(token)
    _upload_file(token, project_id, "model.stl")
    file_bytes = b"solid box\nendsolid"
    with patch("app.routers.projects.get_object", new_callable=AsyncMock, return_value=file_bytes):
        res = client.get(
            f"/api/projects/{project_id}/export",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200
    zf = zipfile.ZipFile(io.BytesIO(res.content))
    assert "model.stl" in zf.namelist()
    assert zf.read("model.stl") == file_bytes


def test_export_viewer_member_allowed() -> None:
    admin_token = _token(_ADMIN_CREDS)
    other_token = _token(_OTHER_CREDS)
    project_id = _create_project(admin_token)

    # Look up the other user's ID to add as member.
    lookup = client.get(
        "/api/users/lookup?email=other@arcsphere3d.dev",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert lookup.status_code == 200
    other_user_id = lookup.json()["id"]

    client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": other_user_id, "role": "viewer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    with patch("app.routers.projects.get_object", new_callable=AsyncMock, return_value=b"data"):
        res = client.get(
            f"/api/projects/{project_id}/export",
            headers={"Authorization": f"Bearer {other_token}"},
        )
    assert res.status_code == 200


def test_export_audit_logged() -> None:
    token = _token(_ADMIN_CREDS)
    project_id = _create_project(token)
    with patch("app.routers.projects.get_object", new_callable=AsyncMock, return_value=b"data"):
        res = client.get(
            f"/api/projects/{project_id}/export",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200

    audit = client.get(
        "/api/admin/audit-logs?action=project_exported",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    assert any(
        log["action"] == "project_exported" and log["resource_id"] == project_id for log in audit
    )
