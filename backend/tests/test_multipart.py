"""Tests for multipart upload endpoints (Issue #131)."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _login() -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def _create_project(token: str) -> str:
    res = client.post(
        "/api/projects",
        json={"name": f"multipart-test-{uuid.uuid4()}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    return res.json()["id"]


# ---- POST /api/files/multipart/init ----


def test_multipart_init_requires_auth() -> None:
    res = client.post(
        "/api/files/multipart/init",
        json={
            "filename": "model.ifc",
            "content_type": "application/octet-stream",
            "total_size_bytes": 50 * 1024 * 1024,
            "part_count": 5,
        },
        params={"project_id": str(uuid.uuid4())},
    )
    assert res.status_code == 401


def test_multipart_init_unknown_project_returns_404() -> None:
    token = _login()
    with (
        patch("app.routers.files.create_multipart_upload", new_callable=AsyncMock) as mock_init,
        patch("app.routers.files.generate_presigned_part_url", new_callable=AsyncMock) as mock_url,
    ):
        mock_init.return_value = "test-upload-id"
        mock_url.return_value = "https://s3.example.com/presigned-part"
        res = client.post(
            "/api/files/multipart/init",
            json={
                "filename": "model.ifc",
                "content_type": "application/octet-stream",
                "total_size_bytes": 50 * 1024 * 1024,
                "part_count": 5,
            },
            params={"project_id": str(uuid.uuid4())},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 404


def test_multipart_init_success() -> None:
    token = _login()
    project_id = _create_project(token)
    with (
        patch("app.routers.files.create_multipart_upload", new_callable=AsyncMock) as mock_init,
        patch("app.routers.files.generate_presigned_part_url", new_callable=AsyncMock) as mock_url,
    ):
        mock_init.return_value = "test-upload-id-xyz"
        mock_url.return_value = "https://s3.example.com/presigned-part"
        res = client.post(
            "/api/files/multipart/init",
            json={
                "filename": "model.ifc",
                "content_type": "application/octet-stream",
                "total_size_bytes": 50 * 1024 * 1024,
                "part_count": 5,
            },
            params={"project_id": project_id},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 201
    body = res.json()
    assert body["upload_id"] == "test-upload-id-xyz"
    assert "s3_key" in body
    assert len(body["part_urls"]) == 5
    assert body["expires_in"] == 3600


def test_multipart_init_rejects_unsupported_extension() -> None:
    token = _login()
    project_id = _create_project(token)
    res = client.post(
        "/api/files/multipart/init",
        json={
            "filename": "virus.exe",
            "content_type": "application/octet-stream",
            "total_size_bytes": 1024,
            "part_count": 1,
        },
        params={"project_id": project_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 415


# ---- POST /api/files/multipart/complete ----


def test_multipart_complete_success() -> None:
    token = _login()
    project_id = _create_project(token)
    with patch(
        "app.routers.files.complete_multipart_upload", new_callable=AsyncMock
    ) as mock_complete:
        res = client.post(
            "/api/files/multipart/complete",
            json={
                "upload_id": "test-upload-id",
                "s3_key": f"{project_id}/someuuid/model.ifc",
                "filename": "model.ifc",
                "total_size_bytes": 50 * 1024 * 1024,
                "content_type": "application/octet-stream",
                "parts": [
                    {"part_number": 1, "etag": '"abc123"'},
                    {"part_number": 2, "etag": '"def456"'},
                ],
            },
            params={"project_id": project_id},
            headers={"Authorization": f"Bearer {token}"},
        )
        mock_complete.assert_called_once()
    assert res.status_code == 201
    body = res.json()
    assert body["filename"] == "model.ifc"
    assert body["size_bytes"] == 50 * 1024 * 1024


# ---- DELETE /api/files/multipart/abort ----


def test_multipart_abort_requires_auth() -> None:
    project_id = str(uuid.uuid4())
    res = client.post(
        "/api/files/multipart/abort",
        params={"project_id": project_id},
        json={"upload_id": "xyz", "s3_key": f"{project_id}/some/key"},
    )
    assert res.status_code == 401


def test_multipart_abort_success() -> None:
    token = _login()
    project_id = _create_project(token)
    s3_key = f"{project_id}/test-id/model.ifc"
    with patch("app.routers.files.abort_multipart_upload", new_callable=AsyncMock) as mock_abort:
        res = client.post(
            "/api/files/multipart/abort",
            params={"project_id": project_id},
            json={"upload_id": "test-id", "s3_key": s3_key},
            headers={"Authorization": f"Bearer {token}"},
        )
        mock_abort.assert_called_once_with(s3_key, "test-id")
    assert res.status_code == 204


# ---- Issue #247 IDOR regression tests ----


def test_multipart_complete_rejects_cross_tenant_s3_key() -> None:
    """complete must reject s3_key that does not start with the project prefix."""
    token = _login()
    project_id = _create_project(token)
    other_project_id = str(uuid.uuid4())
    with patch("app.routers.files.complete_multipart_upload", new_callable=AsyncMock):
        res = client.post(
            "/api/files/multipart/complete",
            params={"project_id": project_id},
            json={
                "upload_id": "uid",
                "s3_key": f"{other_project_id}/uuid/evil.ifc",
                "filename": "evil.ifc",
                "total_size_bytes": 1,
                "content_type": "model/vnd.iges",
                "parts": [{"part_number": 1, "etag": "abc"}],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 422


def test_multipart_abort_rejects_cross_tenant_s3_key() -> None:
    """abort must reject s3_key that does not start with the project prefix."""
    token = _login()
    project_id = _create_project(token)
    other_project_id = str(uuid.uuid4())
    with patch("app.routers.files.abort_multipart_upload", new_callable=AsyncMock):
        res = client.post(
            "/api/files/multipart/abort",
            params={"project_id": project_id},
            json={"upload_id": "uid", "s3_key": f"{other_project_id}/uuid/model.ifc"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 422


def test_multipart_abort_rejects_unauthz_project() -> None:
    """abort must reject a user who has no membership in the target project."""
    owner_token = _login()
    other_token = client.post(
        "/api/auth/login",
        json={"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"},
    ).json()["access_token"]
    project_id = _create_project(owner_token)
    with patch("app.routers.files.abort_multipart_upload", new_callable=AsyncMock):
        res = client.post(
            "/api/files/multipart/abort",
            params={"project_id": project_id},
            json={"upload_id": "uid", "s3_key": f"{project_id}/uuid/model.ifc"},
            headers={"Authorization": f"Bearer {other_token}"},
        )
    assert res.status_code in (403, 404)
