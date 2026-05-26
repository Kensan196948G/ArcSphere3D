"""Integration tests for /api/tags and /api/projects/{id}/tags endpoints."""

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


def _create_project(token: str, name: str = "Tag Test Project") -> str:
    res = client.post("/api/projects", json={"name": name}, headers=_auth(token))
    assert res.status_code == 201
    return res.json()["id"]


def _create_tag(token: str, name: str, color: str = "#6366f1") -> str:
    res = client.post("/api/tags", json={"name": name, "color": color}, headers=_auth(token))
    assert res.status_code == 201, res.text
    return res.json()["id"]


class TestTagCRUD:
    def test_list_tags_empty(self) -> None:
        token = _login(DEMO_CREDS)
        res = client.get("/api/tags", headers=_auth(token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_create_tag(self) -> None:
        token = _login(DEMO_CREDS)
        name = "test-tag-create"
        res = client.post(
            "/api/tags", json={"name": name, "color": "#ff0000"}, headers=_auth(token)
        )
        assert res.status_code == 201
        body = res.json()
        assert body["name"] == name
        assert body["color"] == "#ff0000"
        assert "id" in body

    def test_create_tag_duplicate_returns_409(self) -> None:
        token = _login(DEMO_CREDS)
        name = "duplicate-tag-test"
        client.post("/api/tags", json={"name": name, "color": "#123456"}, headers=_auth(token))
        res = client.post(
            "/api/tags", json={"name": name, "color": "#654321"}, headers=_auth(token)
        )
        assert res.status_code == 409

    def test_create_tag_invalid_color_returns_422(self) -> None:
        token = _login(DEMO_CREDS)
        res = client.post(
            "/api/tags", json={"name": "bad-color", "color": "notacolor"}, headers=_auth(token)
        )
        assert res.status_code in (400, 422)

    def test_delete_tag_by_creator(self) -> None:
        token = _login(DEMO_CREDS)
        tag_id = _create_tag(token, "tag-to-delete")
        res = client.delete(f"/api/tags/{tag_id}", headers=_auth(token))
        assert res.status_code == 204

    def test_delete_tag_by_other_returns_403(self) -> None:
        token = _login(DEMO_CREDS)
        other_token = _login(OTHER_CREDS)
        tag_id = _create_tag(token, "tag-protected")
        res = client.delete(f"/api/tags/{tag_id}", headers=_auth(other_token))
        assert res.status_code == 403

    def test_delete_nonexistent_tag_returns_404(self) -> None:
        token = _login(DEMO_CREDS)
        res = client.delete("/api/tags/00000000-0000-0000-0000-000000000000", headers=_auth(token))
        assert res.status_code == 404


class TestProjectTagAssignment:
    def test_add_tag_to_project(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Project With Tags")
        tag_id = _create_tag(token, "assign-test-tag")
        res = client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
        assert res.status_code == 201
        tags = res.json()
        assert any(t["id"] == tag_id for t in tags)

    def test_add_tag_to_project_idempotent(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Idempotent Tag Project")
        tag_id = _create_tag(token, "idempotent-tag")
        client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
        res = client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
        assert res.status_code == 201

    def test_tags_appear_in_project_list(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "List Tags Project")
        tag_id = _create_tag(token, "list-visible-tag")
        client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
        res = client.get("/api/projects", headers=_auth(token))
        assert res.status_code == 200
        projects = res.json()
        target = next((p for p in projects if p["id"] == project_id), None)
        assert target is not None
        assert any(t["id"] == tag_id for t in target["tags"])

    def test_filter_projects_by_tag(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Filtered Tag Project")
        tag_name = "filter-by-this-tag"
        tag_id = _create_tag(token, tag_name)
        client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
        res = client.get(f"/api/projects?tag={tag_name}", headers=_auth(token))
        assert res.status_code == 200
        projects = res.json()
        assert any(p["id"] == project_id for p in projects)

    def test_remove_tag_from_project(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Remove Tag Project")
        tag_id = _create_tag(token, "remove-me-tag")
        client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
        res = client.delete(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(token))
        assert res.status_code == 204

    def test_add_tag_viewer_returns_403(self) -> None:
        token = _login(DEMO_CREDS)
        other_token = _login(OTHER_CREDS)
        project_id = _create_project(token, "Viewer Tag Restrict Project")
        tag_id = _create_tag(token, "viewer-cant-tag")
        other_user = client.get("/api/users/me", headers=_auth(other_token)).json()
        r = client.post(
            f"/api/projects/{project_id}/members",
            json={"user_id": other_user["id"], "role": "viewer"},
            headers=_auth(token),
        )
        assert r.status_code == 201
        res = client.post(f"/api/projects/{project_id}/tags/{tag_id}", headers=_auth(other_token))
        assert res.status_code == 403
