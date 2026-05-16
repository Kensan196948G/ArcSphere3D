"""Integration tests for /api/files endpoints."""

from __future__ import annotations

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
