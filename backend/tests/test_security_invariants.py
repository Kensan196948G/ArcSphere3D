"""Regression tests for the MVP Critical/High security findings.

Each test pins a single invariant from the internal-review report so a
future change that re-opens the hole fails CI loudly.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from pydantic import ValidationError

from app.config import DEV_JWT_SECRET_DEFAULT, Settings, get_settings
from app.main import app
from app.security import decode_access_token, hash_password

client = TestClient(app)


# ---- C1: jwt.decode enforces issuer + required claims --------------------
def test_decode_rejects_token_with_wrong_issuer() -> None:
    s = get_settings()
    bad = jwt.encode(
        {"sub": "x", "iss": "evil", "exp": 9999999999},
        s.jwt_secret,
        algorithm=s.jwt_algorithm,
    )
    with pytest.raises(ValueError):
        decode_access_token(bad)


def test_decode_rejects_token_missing_iss() -> None:
    s = get_settings()
    bad = jwt.encode(
        {"sub": "x", "exp": 9999999999},
        s.jwt_secret,
        algorithm=s.jwt_algorithm,
    )
    with pytest.raises(ValueError):
        decode_access_token(bad)


# ---- C2: production guard rejects default JWT secret ---------------------
def test_settings_rejects_default_secret_in_production() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret=DEV_JWT_SECRET_DEFAULT)


def test_settings_rejects_short_secret_in_production() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret="short")


def test_settings_accepts_strong_secret_in_production() -> None:
    Settings(app_env="production", jwt_secret="x" * 48)


# ---- C3: CORS wildcard never accepted ------------------------------------
def test_settings_rejects_cors_wildcard_even_in_dev() -> None:
    with pytest.raises(ValidationError):
        Settings(app_env="development", cors_origins="*")


# ---- H1: owner_id is stable across requests (same sub → same owner_id) ---
def test_owner_id_is_deterministic_across_calls() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    p1 = client.post("/api/projects", json={"name": "Det1"}, headers=h)
    p2 = client.post("/api/projects", json={"name": "Det2"}, headers=h)
    assert p1.status_code == 201
    assert p2.status_code == 201
    assert p1.json()["owner_id"] == p2.json()["owner_id"]


# ---- H1+H3 end-to-end: ownership filtering + IDOR defence ---------------
def _login_token() -> str:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    return res.json()["access_token"]


def test_uploaded_projects_are_visible_to_owner() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/projects", json={"name": "Owned"}, headers=h)
    assert created.status_code == 201
    pid = created.json()["id"]

    listed = client.get("/api/projects", headers=h).json()
    assert any(p["id"] == pid for p in listed)

    fetched = client.get(f"/api/projects/{pid}", headers=h)
    assert fetched.status_code == 200


def test_get_unknown_project_returns_404_not_403() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    res = client.get(
        "/api/projects/00000000-0000-0000-0000-000000000000",
        headers=h,
    )
    assert res.status_code == 404


# ---- H3: file upload rejects unknown project_id --------------------------
def test_upload_to_unknown_project_returns_404() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    res = client.post(
        "/api/files/upload",
        params={"project_id": "00000000-0000-0000-0000-000000000000"},
        files={"upload_file": ("model.stl", b"solid x\nendsolid x\n", "model/stl")},
        headers=h,
    )
    assert res.status_code == 404


# ---- H4: hash_password rejects > 72 bytes --------------------------------
def test_hash_password_rejects_overlong_input() -> None:
    with pytest.raises(ValueError):
        hash_password("a" * 73)


# ---- H5: filename sanitisation -------------------------------------------
def test_upload_rejects_path_traversal_filename() -> None:
    token = _login_token()
    h = {"Authorization": f"Bearer {token}"}
    created = client.post("/api/projects", json={"name": "P"}, headers=h)
    pid = created.json()["id"]
    res = client.post(
        "/api/files/upload",
        params={"project_id": pid},
        files={
            "upload_file": (
                "../../etc/passwd.stl",
                b"solid\nendsolid\n",
                "model/stl",
            )
        },
        headers=h,
    )
    # Path stripped to "passwd.stl" and accepted; verify directory prefix is gone.
    if res.status_code == 201:
        assert "/" not in res.json()["filename"]
        assert res.json()["filename"] == "passwd.stl"
    else:
        # Acceptable if rejected; never accept the traversal as-is.
        assert res.status_code in {400, 415}


def test_safe_filename_rejects_null_bytes_and_control_chars() -> None:
    # HTTPX strips NUL bytes from multipart filenames, so test the helper
    # directly — a curl-crafted request would otherwise reach the server.
    from fastapi import HTTPException

    from app.routers.files import _safe_filename

    for evil in ["evil\x00.stl", "x\n.stl", "x\r.stl", "", None, "   "]:
        with pytest.raises(HTTPException) as exc:
            _safe_filename(evil)
        assert exc.value.status_code == 400
