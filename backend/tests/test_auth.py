import base64

from fastapi.testclient import TestClient
from jose import jwt as jose_jwt

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


def test_jwt_uses_rs256_algorithm() -> None:
    """Issued tokens must declare alg=RS256 in the JOSE header."""
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    token = res.json()["access_token"]
    header = jose_jwt.get_unverified_header(token)
    assert header["alg"] == "RS256"


def test_jwt_payload_has_correct_claims() -> None:
    """Issued tokens must carry iss=ArcSphere3D and sub=email."""
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    token = res.json()["access_token"]
    claims = jose_jwt.get_unverified_claims(token)
    assert claims["iss"] == "ArcSphere3D"
    assert claims["sub"] == "demo@arcsphere3d.dev"


def test_tampered_hs256_token_rejected() -> None:
    """Algorithm confusion: a token signed with HS256 must be rejected (401)."""
    import hashlib
    import hmac

    header_b64 = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()
    payload_b64 = (
        base64.urlsafe_b64encode(
            b'{"sub":"demo@arcsphere3d.dev","iss":"ArcSphere3D","exp":9999999999}'
        )
        .rstrip(b"=")
        .decode()
    )
    signing_input = f"{header_b64}.{payload_b64}".encode()
    sig = hmac.new(b"forged-secret", signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    forged_token = f"{header_b64}.{payload_b64}.{sig_b64}"

    res = client.get("/api/projects", headers={"Authorization": f"Bearer {forged_token}"})
    assert res.status_code == 401


def test_jwks_endpoint_returns_rsa_public_key() -> None:
    """GET /api/auth/.well-known/jwks.json must return kty=RSA, alg=RS256, n, e."""
    res = client.get("/api/auth/.well-known/jwks.json")
    assert res.status_code == 200
    body = res.json()
    assert "keys" in body
    key = body["keys"][0]
    assert key["kty"] == "RSA"
    assert key["alg"] == "RS256"
    assert key["use"] == "sig"
    assert "n" in key and len(key["n"]) > 10
    assert "e" in key


def test_jwks_key_can_verify_issued_token() -> None:
    """The RSA public key from JWKS must successfully verify a token issued by the server."""
    from cryptography.hazmat.primitives import serialization as _ser
    from cryptography.hazmat.primitives.asymmetric import rsa as _rsa

    login_res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    token = login_res.json()["access_token"]

    jwks_res = client.get("/api/auth/.well-known/jwks.json")
    jwk = jwks_res.json()["keys"][0]

    def _b64url_to_int(s: str) -> int:
        padded = s + "=" * (-len(s) % 4)
        return int.from_bytes(base64.urlsafe_b64decode(padded), "big")

    pub_numbers = _rsa.RSAPublicNumbers(
        e=_b64url_to_int(jwk["e"]),
        n=_b64url_to_int(jwk["n"]),
    )
    pub_key = pub_numbers.public_key()
    pub_pem = pub_key.public_bytes(
        encoding=_ser.Encoding.PEM,
        format=_ser.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    claims = jose_jwt.decode(token, pub_pem, algorithms=["RS256"])
    assert claims["sub"] == "demo@arcsphere3d.dev"


def test_member_project_appears_in_list() -> None:
    """Projects where user is a member should appear in their project list."""
    owner_token = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    ).json()["access_token"]
    other_token = client.post(
        "/api/auth/login",
        json={"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"},
    ).json()["access_token"]

    pid = client.post(
        "/api/projects",
        json={"name": "Shared Project"},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()["id"]
    other_id = client.get(
        "/api/users/me", headers={"Authorization": f"Bearer {other_token}"}
    ).json()["id"]
    client.post(
        f"/api/projects/{pid}/members",
        json={"user_id": other_id, "role": "viewer"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    projects = client.get(
        "/api/projects", headers={"Authorization": f"Bearer {other_token}"}
    ).json()
    assert any(p["id"] == pid for p in projects)
