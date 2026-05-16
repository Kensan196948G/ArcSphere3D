from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_login_success_returns_jwt() -> None:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"].count(".") == 2  # header.payload.signature


def test_login_rejects_bad_password() -> None:
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "wrong-password-x"},
    )
    assert res.status_code == 401


def test_projects_requires_auth() -> None:
    res = client.get("/api/projects")
    assert res.status_code == 401


def test_projects_with_token() -> None:
    login = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    token = login.json()["access_token"]
    res = client.get("/api/projects", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)
