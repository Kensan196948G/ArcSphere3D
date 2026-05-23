"""Integration tests for PUT /api/projects/{id} (rename + description) and GET /stats."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

DEMO_CREDS = {"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"}
OTHER_CREDS = {"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"}


def _login(creds: dict[str, str]) -> str:
    res = client.post("/api/auth/login", json=creds)
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _create_project(token: str, name: str = "Test Project") -> str:
    res = client.post("/api/projects", json={"name": name}, headers=_auth(token))
    assert res.status_code == 201
    return res.json()["id"]


def _get_user_id(token: str) -> str:
    res = client.get("/api/users/me", headers=_auth(token))
    assert res.status_code == 200
    return res.json()["id"]


def _add_member(token: str, project_id: str, user_id: str, role: str = "editor") -> None:
    res = client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": user_id, "role": role},
        headers=_auth(token),
    )
    assert res.status_code == 201, res.text


# ---- PUT /api/projects/{id} — rename ----------------------------------------


def test_rename_unauthenticated() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    res = client.put(f"/api/projects/{project_id}", json={"name": "New Name"})
    assert res.status_code == 401


def test_rename_by_owner() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token, "Original Name")
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Renamed Project"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Renamed Project"
    assert data["id"] == project_id


def test_rename_by_editor() -> None:
    owner_token = _login(DEMO_CREDS)
    editor_token = _login(OTHER_CREDS)
    project_id = _create_project(owner_token, "Editor Rename Test")
    editor_id = _get_user_id(editor_token)
    _add_member(owner_token, project_id, editor_id, role="editor")
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Editor Renamed"},
        headers=_auth(editor_token),
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Editor Renamed"


def test_rename_by_viewer_forbidden() -> None:
    owner_token = _login(DEMO_CREDS)
    viewer_token = _login(OTHER_CREDS)
    project_id = _create_project(owner_token, "Viewer Rename Test")
    viewer_id = _get_user_id(viewer_token)
    _add_member(owner_token, project_id, viewer_id, role="viewer")
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Should Fail"},
        headers=_auth(viewer_token),
    )
    assert res.status_code == 403


def test_rename_nonexistent_project() -> None:
    token = _login(DEMO_CREDS)
    res = client.put(
        "/api/projects/00000000-0000-0000-0000-000000000000",
        json={"name": "Ghost"},
        headers=_auth(token),
    )
    assert res.status_code == 404


def test_rename_other_users_project_not_found() -> None:
    owner_token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    project_id = _create_project(owner_token, "Private Project")
    # other user is not a member — must see 404 (not 403, IDOR protection)
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Hijack Attempt"},
        headers=_auth(other_token),
    )
    assert res.status_code == 404


def test_rename_empty_name_rejected() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": ""},
        headers=_auth(token),
    )
    assert res.status_code in (400, 422)


def test_rename_nul_byte_rejected() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token)
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "bad\x00name"},
        headers=_auth(token),
    )
    assert res.status_code in (400, 422)


# ---- GET /api/projects/{id}/stats -------------------------------------------


def test_stats_returns_200_for_owner() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token, "Stats Test")
    res = client.get(f"/api/projects/{project_id}/stats", headers=_auth(token))
    assert res.status_code == 200
    body = res.json()
    assert "file_count" in body
    assert "alignment_count" in body
    assert "vertical_count" in body
    assert "member_count" in body
    # Owner is always a member
    assert body["member_count"] >= 1


def test_stats_initial_counts_are_zero_except_member() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token, "Empty Stats Test")
    body = client.get(f"/api/projects/{project_id}/stats", headers=_auth(token)).json()
    assert body["file_count"] == 0
    assert body["alignment_count"] == 0
    assert body["vertical_count"] == 0
    assert body["member_count"] == 1  # owner auto-added


def test_stats_reflects_added_alignment() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token, "Alignment Stats")
    client.post(
        f"/api/projects/{project_id}/alignments",
        json={"name": "R1"},
        headers=_auth(token),
    )
    body = client.get(f"/api/projects/{project_id}/stats", headers=_auth(token)).json()
    assert body["alignment_count"] == 1


def test_stats_non_member_gets_404() -> None:
    owner = _login(DEMO_CREDS)
    other = _login(OTHER_CREDS)
    project_id = _create_project(owner, "Private Stats")
    res = client.get(f"/api/projects/{project_id}/stats", headers=_auth(other))
    assert res.status_code == 404


def test_stats_viewer_can_access() -> None:
    owner = _login(DEMO_CREDS)
    viewer = _login(OTHER_CREDS)
    project_id = _create_project(owner, "Viewer Stats")
    viewer_id = _get_user_id(viewer)
    _add_member(owner, project_id, viewer_id, role="viewer")
    res = client.get(f"/api/projects/{project_id}/stats", headers=_auth(viewer))
    assert res.status_code == 200
    assert res.json()["member_count"] == 2  # owner + viewer


# ---- description field (migration 0009) -------------------------------------


def test_create_project_with_description() -> None:
    token = _login(DEMO_CREDS)
    res = client.post(
        "/api/projects",
        json={"name": "Desc Project", "description": "Road design Q1 2026"},
        headers=_auth(token),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["description"] == "Road design Q1 2026"


def test_create_project_without_description() -> None:
    token = _login(DEMO_CREDS)
    res = client.post("/api/projects", json={"name": "No Desc"}, headers=_auth(token))
    assert res.status_code == 201
    assert res.json()["description"] is None


def test_update_project_description() -> None:
    token = _login(DEMO_CREDS)
    project_id = _create_project(token, "Update Desc")
    res = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Update Desc", "description": "New description"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    assert res.json()["description"] == "New description"


def test_update_project_description_to_null() -> None:
    token = _login(DEMO_CREDS)
    res = client.post(
        "/api/projects",
        json={"name": "Clear Desc", "description": "Will be cleared"},
        headers=_auth(token),
    )
    project_id = res.json()["id"]
    res2 = client.put(
        f"/api/projects/{project_id}",
        json={"name": "Clear Desc", "description": None},
        headers=_auth(token),
    )
    assert res2.status_code == 200
    assert res2.json()["description"] is None


def test_list_projects_includes_description() -> None:
    token = _login(DEMO_CREDS)
    client.post(
        "/api/projects",
        json={"name": "List Desc", "description": "Listed desc"},
        headers=_auth(token),
    )
    res = client.get("/api/projects", headers=_auth(token))
    assert res.status_code == 200
    projects = res.json()
    assert any(p["description"] == "Listed desc" for p in projects)


def test_description_max_length_rejected() -> None:
    token = _login(DEMO_CREDS)
    res = client.post(
        "/api/projects",
        json={"name": "Too Long Desc", "description": "x" * 501},
        headers=_auth(token),
    )
    assert res.status_code == 422


def test_get_project_includes_description() -> None:
    token = _login(DEMO_CREDS)
    res = client.post(
        "/api/projects",
        json={"name": "Get Desc", "description": "Detail here"},
        headers=_auth(token),
    )
    project_id = res.json()["id"]
    res2 = client.get(f"/api/projects/{project_id}", headers=_auth(token))
    assert res2.status_code == 200
    assert res2.json()["description"] == "Detail here"
