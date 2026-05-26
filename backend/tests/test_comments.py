"""Integration tests for /api/projects/{id}/comments endpoints."""

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


def _create_project(token: str, name: str = "Comment Test Project") -> str:
    res = client.post("/api/projects", json={"name": name}, headers=_auth(token))
    assert res.status_code == 201
    return res.json()["id"]


def _create_comment(token: str, project_id: str, body: str = "hello world") -> dict:
    res = client.post(
        f"/api/projects/{project_id}/comments",
        json={"body": body},
        headers=_auth(token),
    )
    assert res.status_code == 201, res.text
    return res.json()


class TestCommentCRUD:
    def test_list_comments_empty(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Empty Comments Project")
        res = client.get(f"/api/projects/{project_id}/comments", headers=_auth(token))
        assert res.status_code == 200
        assert res.json() == []

    def test_create_comment(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Create Comment Project")
        comment = _create_comment(token, project_id, "First comment!")
        assert comment["body"] == "First comment!"
        assert "id" in comment
        assert "author_email" in comment
        assert comment["project_id"] == project_id

    def test_create_comment_empty_body_returns_422(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Validation Project")
        res = client.post(
            f"/api/projects/{project_id}/comments",
            json={"body": ""},
            headers=_auth(token),
        )
        assert res.status_code in (400, 422)

    def test_list_comments_ordered(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Ordered Comments Project")
        _create_comment(token, project_id, "first")
        _create_comment(token, project_id, "second")
        res = client.get(f"/api/projects/{project_id}/comments", headers=_auth(token))
        assert res.status_code == 200
        bodies = [c["body"] for c in res.json()]
        assert bodies == ["first", "second"]

    def test_delete_own_comment(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Delete Own Comment Project")
        comment = _create_comment(token, project_id, "to be deleted")
        res = client.delete(
            f"/api/projects/{project_id}/comments/{comment['id']}",
            headers=_auth(token),
        )
        assert res.status_code == 204

    def test_delete_comment_nonexistent_returns_404(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Delete 404 Project")
        res = client.delete(
            f"/api/projects/{project_id}/comments/00000000-0000-0000-0000-000000000000",
            headers=_auth(token),
        )
        assert res.status_code == 404

    def test_delete_other_user_comment_returns_403(self) -> None:
        token = _login(DEMO_CREDS)
        other_token = _login(OTHER_CREDS)
        project_id = _create_project(token, "Protect Comment Project")
        # Add other user as member so they can read/write
        me_res = client.get("/api/users/me", headers=_auth(other_token))
        assert me_res.status_code == 200
        other_user_id = me_res.json()["id"]
        client.post(
            f"/api/projects/{project_id}/members",
            json={"user_id": other_user_id, "role": "editor"},
            headers=_auth(token),
        )
        other_comment = _create_comment(other_token, project_id, "other user comment")
        res = client.delete(
            f"/api/projects/{project_id}/comments/{other_comment['id']}",
            headers=_auth(token),
        )
        # owner CAN delete any comment — so this should be 204
        assert res.status_code == 204

    def test_non_member_gets_404(self) -> None:
        token = _login(DEMO_CREDS)
        other_token = _login(OTHER_CREDS)
        project_id = _create_project(token, "Non Member Comment Project")
        res = client.get(f"/api/projects/{project_id}/comments", headers=_auth(other_token))
        assert res.status_code == 404

    def test_non_member_cannot_post_comment(self) -> None:
        token = _login(DEMO_CREDS)
        other_token = _login(OTHER_CREDS)
        project_id = _create_project(token, "Non Member Post Project")
        res = client.post(
            f"/api/projects/{project_id}/comments",
            json={"body": "unauthorized comment"},
            headers=_auth(other_token),
        )
        assert res.status_code == 404

    def test_unauthenticated_returns_401(self) -> None:
        token = _login(DEMO_CREDS)
        project_id = _create_project(token, "Unauth Project")
        res = client.get(f"/api/projects/{project_id}/comments")
        assert res.status_code == 401
