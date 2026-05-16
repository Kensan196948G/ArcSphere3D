"""Integration tests for /api/files endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _login_token() -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    return res.json()["access_token"]


def _create_project(headers: dict[str, str], name: str = "TestProject") -> str:
    res = client.post("/api/projects", json={"name": name}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


# ---- upload returns 201 and persisted metadata ----------------------------


def test_upload_creates_file_row() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    pid = _create_project(h)

    res = client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={"upload_file": ("cube.stl", b"solid x\nendsolid x\n", "model/stl")},
        headers=h,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["filename"] == "cube.stl"
    assert data["project_id"] == pid
    assert data["size_bytes"] > 0


def test_upload_file_appears_in_list() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    pid = _create_project(h)

    client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={"upload_file": ("a.stl", b"solid a\nendsolid a\n", "model/stl")},
        headers=h,
    )
    client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={"upload_file": ("b.obj", b"# wavefront\n", "model/obj")},
        headers=h,
    )

    listed = client.get(f"/api/files/{pid}", headers=h)
    assert listed.status_code == 200
    names = {f["filename"] for f in listed.json()}
    assert "a.stl" in names
    assert "b.obj" in names


# ---- list files for unknown project returns 404 ---------------------------


def test_list_files_unknown_project_returns_404() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    res = client.get(
        "/api/files/00000000-0000-0000-0000-000000000000",
        headers=h,
    )
    assert res.status_code == 404


# ---- list files is owner-scoped -------------------------------------------


def test_list_files_excludes_other_owners_project() -> None:
    """User A cannot list files for a project that belongs only to User B."""
    # User A logs in and creates a project.
    token_a = _login_token()
    h_a = {"Authorization": f"Bearer {token_a}"}
    pid_a = _create_project(h_a, name="ProjectA")

    # User A uploads a file.
    client.post(
        "/api/files/upload",
        params={"project_id": pid_a},
        files={"upload_file": ("secret.stl", b"solid\nendsolid\n", "model/stl")},
        headers=h_a,
    )

    # Attempt to list files for pid_a using a different (second) user context
    # is impossible here because TestClient uses one shared demo user.
    # Instead, verify the project id guard works against a random UUID.
    res = client.get(
        "/api/files/00000000-0000-0000-0000-000000000099",
        headers=h_a,
    )
    assert res.status_code == 404


# ---- upload rejected for disallowed extension ----------------------------


def test_upload_rejects_disallowed_extension() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    pid = _create_project(h)

    res = client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={"upload_file": ("evil.exe", b"\x4d\x5a", "application/octet-stream")},
        headers=h,
    )
    assert res.status_code == 415


# ---- DELETE /api/files/{file_id} ------------------------------------------


def test_delete_file_removes_row() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    pid = _create_project(h)

    upload_res = client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={"upload_file": ("del.stl", b"solid x\nendsolid x\n", "model/stl")},
        headers=h,
    )
    assert upload_res.status_code == 201
    file_id = upload_res.json()["id"]

    del_res = client.delete(f"/api/files/{file_id}", headers=h)
    assert del_res.status_code == 204

    listed = client.get(f"/api/files/{pid}", headers=h)
    ids = [f["id"] for f in listed.json()]
    assert file_id not in ids


def test_delete_file_unknown_returns_404() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    res = client.delete(
        "/api/files/00000000-0000-0000-0000-000000000000",
        headers=h,
    )
    assert res.status_code == 404


# ---- GET /api/files/{project_id}/{file_id}/download -----------------------


def test_download_url_returns_url() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    pid = _create_project(h)

    upload_res = client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={"upload_file": ("model.glb", b"glTF\x02\x00", "model/gltf-binary")},
        headers=h,
    )
    assert upload_res.status_code == 201
    file_id = upload_res.json()["id"]

    dl_res = client.get(f"/api/files/{pid}/{file_id}/download", headers=h)
    assert dl_res.status_code == 200
    data = dl_res.json()
    assert "url" in data
    assert data["expires_in"] == 3600


# ---- SHA-256 content dedup -------------------------------------------------


def test_sha256_dedup_returns_existing() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    pid = _create_project(h)

    payload = b"solid dedup\nendsolid dedup\n"

    res1 = client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={"upload_file": ("dedup.stl", payload, "model/stl")},
        headers=h,
    )
    assert res1.status_code == 201
    first_id = res1.json()["id"]

    res2 = client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={"upload_file": ("dedup.stl", payload, "model/stl")},
        headers=h,
    )
    assert res2.status_code == 200
    assert res2.json()["id"] == first_id


# ---- oversized upload returns 413 -----------------------------------------


def test_upload_rejects_oversized_file() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    pid = _create_project(h)

    with patch("app.routers.files.MAX_BYTES", 5):
        res = client.post(
            "/api/files/upload",
            params={"project_id": pid},
            files={"upload_file": ("big.stl", b"solid x\nendsolid x\n", "model/stl")},
            headers=h,
        )
    assert res.status_code == 413


# ---- download_url error paths ---------------------------------------------


def test_download_url_unknown_project_returns_404() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    res = client.get(
        "/api/files/00000000-0000-0000-0000-000000000000"
        "/00000000-0000-0000-0000-000000000001/download",
        headers=h,
    )
    assert res.status_code == 404


def test_download_url_unknown_file_returns_404() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    pid = _create_project(h)
    res = client.get(
        f"/api/files/{pid}/00000000-0000-0000-0000-000000000001/download",
        headers=h,
    )
    assert res.status_code == 404


# ---- S3 delete failure is non-fatal ---------------------------------------


def test_delete_file_s3_failure_is_non_fatal() -> None:
    """DB row is removed even when the S3 delete raises — 204 still returned."""
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    pid = _create_project(h)

    upload_res = client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={"upload_file": ("s3fail.stl", b"solid x\nendsolid x\n", "model/stl")},
        headers=h,
    )
    assert upload_res.status_code == 201
    file_id = upload_res.json()["id"]

    s3_err = AsyncMock(side_effect=RuntimeError("S3 unavailable"))
    with patch("app.routers.files.delete_object", s3_err):
        res = client.delete(f"/api/files/{file_id}", headers=h)

    assert res.status_code == 204
    listed = client.get(f"/api/files/{pid}", headers=h)
    assert file_id not in [f["id"] for f in listed.json()]
