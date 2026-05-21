"""Tests for multipart upload endpoints — Issue #131."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _login_token(email: str = "demo@arcsphere3d.dev") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": "arcsphere-demo"})
    assert res.status_code == 200
    return res.json()["access_token"]


def _create_project(token: str, name: str = "Test Project") -> str:
    res = client.post(
        "/api/projects",
        json={"name": name},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    return res.json()["id"]


FAKE_UPLOAD_ID = "test-upload-id-12345"
FAKE_PRESIGNED_URL = "https://minio.example.com/presigned"


def _patch_s3():
    return [
        patch("app.routers.multipart.create_multipart_upload", AsyncMock(return_value=FAKE_UPLOAD_ID)),
        patch("app.routers.multipart.generate_presigned_part_url", AsyncMock(return_value=FAKE_PRESIGNED_URL)),
        patch("app.routers.multipart.complete_multipart_upload", AsyncMock()),
        patch("app.routers.multipart.abort_multipart_upload", AsyncMock()),
    ]


def test_multipart_init_requires_auth() -> None:
    res = client.post("/api/files/multipart/init", json={
        "project_id": str(uuid4()),
        "filename": "test.ifc",
        "file_size": 100_000_000,
    })
    assert res.status_code == 401


def test_multipart_init_returns_presigned_urls() -> None:
    token = _login_token()
    project_id = _create_project(token)
    chunk_size = 10 * 1024 * 1024  # 10 MB
    file_size = 25 * 1024 * 1024   # 25 MB → 3 parts

    with _patch_s3()[0], _patch_s3()[1]:
        with (
            patch("app.routers.multipart.create_multipart_upload", AsyncMock(return_value=FAKE_UPLOAD_ID)),
            patch("app.routers.multipart.generate_presigned_part_url", AsyncMock(return_value=FAKE_PRESIGNED_URL)),
        ):
            res = client.post(
                "/api/files/multipart/init",
                json={
                    "project_id": project_id,
                    "filename": "large-model.ifc",
                    "file_size": file_size,
                    "chunk_size": chunk_size,
                },
                headers={"Authorization": f"Bearer {token}"},
            )

    assert res.status_code == 201
    body = res.json()
    assert "upload_token" in body
    assert body["upload_id"] == FAKE_UPLOAD_ID
    assert body["total_parts"] == 3
    assert len(body["parts"]) == 3
    assert all(p["presigned_url"] == FAKE_PRESIGNED_URL for p in body["parts"])


def test_multipart_init_rejects_unsupported_extension() -> None:
    token = _login_token()
    project_id = _create_project(token)

    with (
        patch("app.routers.multipart.create_multipart_upload", AsyncMock(return_value=FAKE_UPLOAD_ID)),
        patch("app.routers.multipart.generate_presigned_part_url", AsyncMock(return_value=FAKE_PRESIGNED_URL)),
    ):
        res = client.post(
            "/api/files/multipart/init",
            json={
                "project_id": project_id,
                "filename": "virus.exe",
                "file_size": 1_000_000,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 400


def test_multipart_complete_creates_file_record() -> None:
    token = _login_token()
    project_id = _create_project(token)

    with (
        patch("app.routers.multipart.create_multipart_upload", AsyncMock(return_value=FAKE_UPLOAD_ID)),
        patch("app.routers.multipart.generate_presigned_part_url", AsyncMock(return_value=FAKE_PRESIGNED_URL)),
        patch("app.routers.multipart.complete_multipart_upload", AsyncMock()),
    ):
        init_res = client.post(
            "/api/files/multipart/init",
            json={
                "project_id": project_id,
                "filename": "building.ifc",
                "file_size": 10 * 1024 * 1024,
                "chunk_size": 10 * 1024 * 1024,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert init_res.status_code == 201
        upload_token = init_res.json()["upload_token"]

        complete_res = client.post(
            "/api/files/multipart/complete",
            json={
                "upload_token": upload_token,
                "parts": [{"part_number": 1, "etag": '"abc123"'}],
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert complete_res.status_code == 200
    body = complete_res.json()
    assert body["filename"] == "building.ifc"
    assert body["project_id"] == project_id


def test_multipart_abort_returns_204() -> None:
    token = _login_token()
    project_id = _create_project(token)

    with (
        patch("app.routers.multipart.create_multipart_upload", AsyncMock(return_value=FAKE_UPLOAD_ID)),
        patch("app.routers.multipart.generate_presigned_part_url", AsyncMock(return_value=FAKE_PRESIGNED_URL)),
        patch("app.routers.multipart.abort_multipart_upload", AsyncMock()),
    ):
        init_res = client.post(
            "/api/files/multipart/init",
            json={
                "project_id": project_id,
                "filename": "model.glb",
                "file_size": 10 * 1024 * 1024,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        upload_token = init_res.json()["upload_token"]

        abort_res = client.delete(
            "/api/files/multipart/abort",
            json={"upload_token": upload_token},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert abort_res.status_code == 204


def test_multipart_complete_not_found() -> None:
    token = _login_token()
    res = client.post(
        "/api/files/multipart/complete",
        json={
            "upload_token": str(uuid4()),
            "parts": [{"part_number": 1, "etag": '"abc"'}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
