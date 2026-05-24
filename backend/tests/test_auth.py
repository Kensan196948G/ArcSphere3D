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
    """Issued tokens must carry iss=ArcSphere3D, sub=user.id (UUID), email=email."""
    from uuid import UUID

    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    token = res.json()["access_token"]
    claims = jose_jwt.get_unverified_claims(token)
    assert claims["iss"] == "ArcSphere3D"
    # sub is now an immutable UUID (Issue #180), email lives in a separate claim
    UUID(claims["sub"])  # raises if not a valid UUID
    assert claims["email"] == "demo@arcsphere3d.dev"


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
    # sub is the immutable UUID (Issue #180); we just verify it round-trips
    from uuid import UUID

    UUID(claims["sub"])
    assert claims["email"] == "demo@arcsphere3d.dev"


def test_login_rate_limit_blocks_after_max_attempts() -> None:
    """6th attempt within the window must return 429 with Retry-After header."""
    from app.routers.auth import _login_limiter

    _login_limiter.reset()
    for _ in range(5):
        client.post(
            "/api/auth/login",
            json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
        )
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 429
    assert "Retry-After" in res.headers


def test_login_rate_limit_resets_after_clear() -> None:
    """After limiter.reset(), the endpoint is accessible again."""
    from app.routers.auth import _login_limiter

    for _ in range(5):
        client.post(
            "/api/auth/login",
            json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
        )
    _login_limiter.reset()
    res = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert res.status_code == 200


def test_refresh_reflects_role_change_by_admin() -> None:
    """POST /refresh must return a token with the DB role, not the JWT payload role."""
    admin_token = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    ).json()["access_token"]

    # Create a viewer user.
    viewer_res = client.post(
        "/api/admin/users",
        json={
            "email": "role-sync-test@arcsphere3d.dev",
            "password": "init-pass-1!",
            "role": "viewer",
        },  # noqa: E501
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert viewer_res.status_code == 201
    uid = viewer_res.json()["id"]

    # Login as viewer — token carries role=viewer.
    viewer_token = client.post(
        "/api/auth/login",
        json={"email": "role-sync-test@arcsphere3d.dev", "password": "init-pass-1!"},
    ).json()["access_token"]
    assert jose_jwt.get_unverified_claims(viewer_token)["role"] == "viewer"

    # Admin promotes the viewer to editor.
    patch_res = client.patch(
        f"/api/admin/users/{uid}/role",
        json={"role": "editor"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert patch_res.status_code == 200

    # Viewer refreshes with the old token — new token must carry role=editor.
    refresh_res = client.post(
        "/api/auth/refresh",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert refresh_res.status_code == 200
    new_claims = jose_jwt.get_unverified_claims(refresh_res.json()["access_token"])
    assert new_claims["role"] == "editor"


def test_refresh_unauthenticated_returns_401() -> None:
    res = client.post("/api/auth/refresh")
    assert res.status_code == 401


def test_legacy_email_sub_token_is_rejected_centrally() -> None:
    """Issue #180 adversarial-review regression.

    A token whose `sub` is an email (the pre-migration shape) must be rejected
    by `get_current_user` before it reaches any handler — otherwise the admin
    self-guard (`str(target.id) == current.sub`) could be bypassed by anyone
    still holding a valid legacy token. We mint such a token here using the
    same signing key the app uses, then assert that several representative
    protected routes — including the admin ones — all return 401.
    """
    from app.security import create_access_token

    legacy_token = create_access_token(
        subject="demo@arcsphere3d.dev",
        extra={"email": "demo@arcsphere3d.dev", "role": "admin"},
    )
    headers = {"Authorization": f"Bearer {legacy_token}"}

    # Routes that previously used `current.sub` directly — must all 401 now.
    me_res = client.get("/api/users/me", headers=headers)
    assert me_res.status_code == 401
    projects_res = client.get("/api/projects", headers=headers)
    assert projects_res.status_code == 401
    admin_users_res = client.get("/api/admin/users", headers=headers)
    assert admin_users_res.status_code == 401


def test_non_canonical_uuid_sub_cannot_bypass_admin_self_guard() -> None:
    """Adversarial-review follow-up regression.

    Python's `UUID()` accepts several textual spellings (uppercase, no hyphens,
    `urn:uuid:` prefix) of the same value. Before normalization, a token
    minted with the admin's UUID in any of these alternate spellings would
    pass authentication but compare unequal to `str(target.id)`, letting the
    admin slip past the self-delete / self-demote guard. `get_current_user`
    now canonicalizes via `str(UUID(sub))`, so this test asserts that even a
    non-canonical sub for the admin's own row is recognized as self.
    """
    from app.security import create_access_token

    # Log in normally to discover the demo admin's canonical UUID.
    login = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    canonical_token = login.json()["access_token"]
    admin_id = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {canonical_token}"},
    ).json()["id"]

    # Mint a token whose sub is the same UUID, but in upper-case and stripped
    # of hyphens — the exact bypass shape Codex flagged.
    forged = create_access_token(
        subject=admin_id.replace("-", "").upper(),
        extra={"email": "demo@arcsphere3d.dev", "role": "admin"},
    )
    res = client.delete(
        f"/api/admin/users/{admin_id}",
        headers={"Authorization": f"Bearer {forged}"},
    )
    # The self-guard must still fire (403 'cannot delete your own account'),
    # NOT silently delete the admin (204).
    assert res.status_code == 403, f"self-guard bypassed: {res.status_code} {res.text}"


def test_token_with_non_string_sub_returns_401() -> None:
    """A signed token whose `sub` is an int / null / array must 401, not 500.

    `uuid.UUID()` raises `TypeError` (not `ValueError`) for non-string input,
    so the central UUID check has to catch both — otherwise malformed tokens
    leak as server errors.
    """
    from app.config import get_settings
    from app.security import _get_or_generate_keys

    priv_pem, _ = _get_or_generate_keys(get_settings())
    from datetime import UTC, datetime, timedelta

    now = datetime.now(UTC)
    settings = get_settings()
    bogus = jose_jwt.encode(
        {
            "sub": 12345,  # int, not a UUID string
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=10)).timestamp()),
            "iss": settings.app_name,
            "email": "x@arcsphere3d.dev",
            "role": "admin",
        },
        priv_pem,
        algorithm="RS256",
    )
    res = client.get("/api/users/me", headers={"Authorization": f"Bearer {bogus}"})
    assert res.status_code == 401


def test_token_with_random_uuid_for_unknown_user_returns_401() -> None:
    """A well-formed UUID sub that does not match any user must 401, not 500.

    Closes the adversarial-review concern that `upsert_user` could silently
    fall back to email-based lookup or fabricate a new row when the JWT sub
    has no matching DB user (e.g. deleted account, forged-but-syntactic UUID).
    """
    from uuid import uuid4

    from app.security import create_access_token

    orphan_token = create_access_token(
        subject=str(uuid4()),
        extra={"email": "ghost@arcsphere3d.dev", "role": "admin"},
    )
    res = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {orphan_token}"},
    )
    assert res.status_code == 401


def test_demoted_admin_token_cannot_keep_calling_admin_routes() -> None:
    """Adversarial-review round 4 regression.

    A stateless JWT carries the role at issuance time. If we authorized purely
    from `claims['role']`, a demoted admin could keep calling `/api/admin/*`
    for the remainder of the access-token lifetime. `_require_admin` now
    reloads the actor from the DB and authorizes from the live role.
    """
    from app.security import create_access_token

    # Log in as a non-admin user, then mint a token *claiming* admin role.
    other_login = client.post(
        "/api/auth/login",
        json={"email": "other@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert other_login.status_code == 200
    other_id = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {other_login.json()['access_token']}"},
    ).json()["id"]
    forged_admin = create_access_token(
        subject=other_id,
        extra={"email": "other@arcsphere3d.dev", "role": "admin"},
    )
    # DB says viewer, so admin route must 403 even though token claims admin.
    res = client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {forged_admin}"},
    )
    assert (
        res.status_code == 403
    ), f"stale JWT role claim authorized admin route: {res.status_code} {res.text}"


def test_deleted_user_token_is_rejected_on_admin_routes() -> None:
    """Adversarial-review round 4 regression.

    A token issued before user deletion must 401 on protected admin endpoints
    once the row is gone, not silently accept the stale claim.
    """
    from uuid import uuid4

    from app.security import create_access_token

    # Token for a UUID that has no DB row.
    ghost = create_access_token(
        subject=str(uuid4()),
        extra={"email": "ghost@arcsphere3d.dev", "role": "admin"},
    )
    res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {ghost}"})
    assert res.status_code == 401


def test_admin_mutation_locks_actor_and_target_in_uuid_order() -> None:
    """Adversarial-review round 6 regression.

    Round 5 took ``FOR UPDATE`` on the actor row inside the admin gate, which
    closed the gate↔write TOCTOU window but introduced a cross-admin deadlock
    (request 1 locks A then waits B; request 2 locks B then waits A). Round 6
    moves the lock to the mutation handler and acquires actor + target rows in
    UUID order via ``crud.lock_user_pair_for_update``. We verify here that an
    admin mutation invokes the pair-lock helper, and that the order of the
    individual locked SELECTs follows the UUID total order — that ordering is
    what makes the lock graph acyclic across all concurrent admin requests.
    """
    from unittest.mock import patch

    from app.db import crud as crud_module

    admin_login = client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    assert admin_login.status_code == 200, admin_login.text
    admin_token = admin_login.json()["access_token"]
    admin_id = client.get(
        "/api/users/me", headers={"Authorization": f"Bearer {admin_token}"}
    ).json()["id"]

    # Create a fresh target user to update — UUIDs are random, both orderings
    # (admin < target / target < admin) are exercised across CI runs over time,
    # so a single test covers the symmetry.
    create_res = client.post(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "email": "round6-target@arcsphere3d.dev",
            "password": "arcsphere-demo",
            "role": "viewer",
        },
    )
    assert create_res.status_code == 201, create_res.text
    target_id = create_res.json()["id"]

    locked_ids: list[str] = []
    real_locked = crud_module.get_user_by_id_for_update

    async def _spy_locked(session: object, user_id: object) -> object:
        locked_ids.append(str(user_id))
        return await real_locked(session, user_id)  # type: ignore[arg-type]

    with (
        patch.object(crud_module, "get_user_by_id_for_update", side_effect=_spy_locked),
        patch.object(
            crud_module,
            "lock_user_pair_for_update",
            wraps=crud_module.lock_user_pair_for_update,
        ) as pair_spy,
    ):
        res = client.patch(
            f"/api/admin/users/{target_id}/role",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "editor"},
        )
    assert res.status_code == 200, res.text
    assert pair_spy.call_count == 1, (
        f"admin mutation must call lock_user_pair_for_update exactly once; "
        f"called {pair_spy.call_count} times"
    )
    assert (
        len(locked_ids) == 2
    ), f"pair lock must acquire two row locks (actor, target); got {locked_ids}"
    # UUID order invariant — the smaller UUID is locked first regardless of which
    # role (actor vs target) it plays. This is what kills the deadlock cycle.
    assert locked_ids == sorted(
        locked_ids
    ), f"row locks must be acquired in UUID order to avoid deadlock; got {locked_ids}"
    # Sanity: the pair must include both admin and target.
    assert {admin_id, target_id} == set(
        locked_ids
    ), f"pair lock must cover both actor and target; got {locked_ids}"


def test_get_user_by_id_for_update_compiles_with_for_update_clause() -> None:
    """Adversarial-review round 5 regression.

    Statically verify the row-locked crud helper emits ``FOR UPDATE`` so that a
    refactor cannot silently downgrade the lock to a plain SELECT.
    """
    from uuid import uuid4

    from sqlalchemy import select

    from app.models.user import User

    stmt = select(User).where(User.id == uuid4()).with_for_update()
    compiled = stmt.compile(
        dialect=__import__("sqlalchemy.dialects.postgresql", fromlist=["dialect"]).dialect(),
        compile_kwargs={"literal_binds": False},
    )
    sql = str(compiled).upper()
    assert "FOR UPDATE" in sql, f"expected FOR UPDATE clause in compiled SQL: {sql}"


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
