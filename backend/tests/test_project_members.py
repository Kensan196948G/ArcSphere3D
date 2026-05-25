"""Integration tests for the project members (RBAC) API."""

from __future__ import annotations

import uuid

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


# ---- Auth guard ----


def test_members_requires_auth() -> None:
    pid = str(uuid.uuid4())
    res = client.get(f"/api/projects/{pid}/members")
    assert res.status_code == 401


# ---- List members ----


def test_list_members_contains_owner_on_creation() -> None:
    """Issue #66: creating a project now auto-adds the owner to project_members."""
    token = _login(DEMO_CREDS)
    owner_id = _get_user_id(token)
    pid = _create_project(token)
    res = client.get(f"/api/projects/{pid}/members", headers=_auth(token))
    assert res.status_code == 200
    members = res.json()
    assert len(members) == 1
    assert members[0]["user_id"] == owner_id
    assert members[0]["role"] == "owner"


# ---- Add member ----


def test_add_member_returns_201() -> None:
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["user_id"] == other_id
    assert body["role"] == "editor"
    assert body["project_id"] == pid


def test_add_member_updates_existing_role() -> None:
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )
    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "viewer"},
        headers=_auth(token),
    )
    assert res.status_code == 201
    assert res.json()["role"] == "viewer"


def test_add_member_invalid_role_rejected() -> None:
    token = _login(DEMO_CREDS)
    pid = _create_project(token)
    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": str(uuid.uuid4()), "role": "superuser"},
        headers=_auth(token),
    )
    assert res.status_code in (400, 422)


# ---- Remove member ----


def test_remove_member_returns_204() -> None:
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "viewer"},
        headers=_auth(token),
    )
    res = client.delete(f"/api/projects/{pid}/members/{other_id}", headers=_auth(token))
    assert res.status_code == 204


def test_remove_nonexistent_member_returns_404() -> None:
    token = _login(DEMO_CREDS)
    pid = _create_project(token)
    fake_uid = str(uuid.uuid4())
    res = client.delete(f"/api/projects/{pid}/members/{fake_uid}", headers=_auth(token))
    assert res.status_code == 404


def test_add_nonexistent_user_returns_404() -> None:
    """Regression test for #67: an unknown user_id used to cascade into a
    PostgreSQL FK violation and surface as 500. The router now translates
    the missing-user case to a clean 404.
    """
    token = _login(DEMO_CREDS)
    pid = _create_project(token)
    fake_uid = str(uuid.uuid4())
    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": fake_uid, "role": "viewer"},
        headers=_auth(token),
    )
    assert res.status_code == 404
    assert "user not found" in res.text.lower()


# ---- IDOR protection ----


def test_non_member_cannot_list_members_gets_404() -> None:
    """Non-members still receive 404 to prevent IDOR disclosure."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)

    res = client.get(f"/api/projects/{pid}/members", headers=_auth(other_token))
    assert res.status_code == 404


# ---- Issue #73: editor/viewer read access ----


def test_editor_can_list_members() -> None:
    """An editor member may read the members list (read-only access)."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    # Add other user as editor
    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )

    res = client.get(f"/api/projects/{pid}/members", headers=_auth(other_token))
    assert res.status_code == 200
    user_ids = [m["user_id"] for m in res.json()]
    assert other_id in user_ids


def test_viewer_can_list_members() -> None:
    """A viewer member may read the members list (read-only access)."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    # Add other user as viewer
    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "viewer"},
        headers=_auth(token),
    )

    res = client.get(f"/api/projects/{pid}/members", headers=_auth(other_token))
    assert res.status_code == 200
    assert any(m["user_id"] == other_id for m in res.json())


def test_editor_cannot_add_member_gets_403() -> None:
    """Editors may not add new members — only owners can."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    # Add other user as editor
    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )

    # Editor tries to add themselves back (or anyone) — must be 403
    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "owner"},
        headers=_auth(other_token),
    )
    assert res.status_code == 403


def test_viewer_cannot_remove_member_gets_403() -> None:
    """Viewers may not remove members — only owners can."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    owner_id = _get_user_id(token)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    # Add other user as viewer
    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "viewer"},
        headers=_auth(token),
    )

    # Viewer tries to remove the owner — must be 403
    res = client.delete(f"/api/projects/{pid}/members/{owner_id}", headers=_auth(other_token))
    assert res.status_code == 403


def test_member_list_includes_email_field() -> None:
    """Issue #73: MemberOut must include the email field."""
    token = _login(DEMO_CREDS)
    pid = _create_project(token)
    res = client.get(f"/api/projects/{pid}/members", headers=_auth(token))
    assert res.status_code == 200
    members = res.json()
    assert len(members) >= 1
    assert "email" in members[0]
    assert "@" in members[0]["email"]


# ---- Last-owner protection (Issue #66) ----


def test_cannot_remove_last_owner_returns_409() -> None:
    """Removing the sole owner from project_members must return 409 Conflict."""
    token = _login(DEMO_CREDS)
    owner_id = _get_user_id(token)
    pid = _create_project(token)

    res = client.delete(f"/api/projects/{pid}/members/{owner_id}", headers=_auth(token))
    assert res.status_code == 409
    assert "last owner" in res.text.lower()


def test_can_remove_non_last_owner() -> None:
    """When two owners exist, either can be removed."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    # Promote other user to owner
    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "owner"},
        headers=_auth(token),
    )
    assert res.status_code == 201

    # Now there are 2 owners — removing the second one should succeed
    res = client.delete(f"/api/projects/{pid}/members/{other_id}", headers=_auth(token))
    assert res.status_code == 204


def test_can_remove_non_owner_member() -> None:
    """Removing an editor or viewer member is always permitted (no last-owner clash)."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )
    res = client.delete(f"/api/projects/{pid}/members/{other_id}", headers=_auth(token))
    assert res.status_code == 204


def test_transfer_ownership_then_remove_original_owner() -> None:
    """Transfer ownership: add second owner → promote → remove original owner."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    owner_id = _get_user_id(token)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    # Add the other user as owner
    res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "owner"},
        headers=_auth(token),
    )
    assert res.status_code == 201

    # Original owner can now be removed (2 owners exist)
    res = client.delete(f"/api/projects/{pid}/members/{owner_id}", headers=_auth(token))
    assert res.status_code == 204

    # Verify only the new owner remains
    res = client.get(f"/api/projects/{pid}/members", headers=_auth(other_token))
    assert res.status_code == 200
    remaining = res.json()
    roles = {m["user_id"]: m["role"] for m in remaining}
    # original owner removed, new owner still present
    assert owner_id not in roles or roles[owner_id] != "owner"
    assert roles.get(other_id) == "owner"


# ---- PATCH /members/{user_id} (Issue #215) ----


def test_update_member_role_returns_200() -> None:
    """Owner can change an editor's role to viewer and get updated MemberOut."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    # Add other user as editor
    add_res = client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )
    assert add_res.status_code == 201

    # Owner changes role to viewer
    res = client.patch(
        f"/api/projects/{pid}/members/{other_id}",
        json={"role": "viewer"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == other_id
    assert data["role"] == "viewer"
    assert data["project_id"] == pid


def test_update_member_role_to_owner() -> None:
    """Owner can promote an editor to owner role."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )

    res = client.patch(
        f"/api/projects/{pid}/members/{other_id}",
        json={"role": "owner"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    assert res.json()["role"] == "owner"


def test_update_nonexistent_member_role_returns_404() -> None:
    """Patching a user_id that has no membership returns 404."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)
    # other_id is NOT added as member

    res = client.patch(
        f"/api/projects/{pid}/members/{other_id}",
        json={"role": "viewer"},
        headers=_auth(token),
    )
    assert res.status_code == 404


def test_update_role_last_owner_returns_409() -> None:
    """Demoting the sole owner must return 409 Conflict."""
    token = _login(DEMO_CREDS)
    owner_id = _get_user_id(token)
    pid = _create_project(token)

    res = client.patch(
        f"/api/projects/{pid}/members/{owner_id}",
        json={"role": "editor"},
        headers=_auth(token),
    )
    assert res.status_code == 409
    assert "last owner" in res.text.lower()


def test_update_role_with_two_owners_demotes_ok() -> None:
    """When 2 owners exist, demoting one succeeds (no 409)."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    # Promote other user to owner
    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "owner"},
        headers=_auth(token),
    )

    # Now demote other user back to editor — 2 owners, so allowed
    res = client.patch(
        f"/api/projects/{pid}/members/{other_id}",
        json={"role": "editor"},
        headers=_auth(token),
    )
    assert res.status_code == 200
    assert res.json()["role"] == "editor"


def test_non_owner_cannot_update_role_returns_403() -> None:
    """Editor may not call PATCH /members/{user_id} — owner only."""
    token = _login(DEMO_CREDS)
    other_token = _login(OTHER_CREDS)
    owner_id = _get_user_id(token)
    pid = _create_project(token)
    other_id = _get_user_id(other_token)

    # Add other user as editor
    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "editor"},
        headers=_auth(token),
    )

    # Editor tries to change owner's role — must be 403
    res = client.patch(
        f"/api/projects/{pid}/members/{owner_id}",
        json={"role": "viewer"},
        headers=_auth(other_token),
    )
    assert res.status_code == 403


def test_update_role_invalid_role_returns_400() -> None:
    """Body validation: unknown role string must return 400."""
    token = _login(DEMO_CREDS)
    owner_id = _get_user_id(token)
    pid = _create_project(token)

    res = client.patch(
        f"/api/projects/{pid}/members/{owner_id}",
        json={"role": "superadmin"},
        headers=_auth(token),
    )
    assert res.status_code in (400, 422)
