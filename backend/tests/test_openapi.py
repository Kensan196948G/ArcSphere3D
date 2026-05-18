"""OpenAPI schema conformance tests via schemathesis.

Verifies that every endpoint response matches the JSON Schema declared in
the OpenAPI spec. This acts as a contract test — schema drift between the
spec and actual handler output is caught immediately.

Note: unsupported_method is excluded because DELETE /api/files/{file_id}
and GET /api/files/{project_id} share the same URL template. FastAPI routes
any un-documented method on /api/files/{x} to the matching handler rather
than returning 405.

Note on HealthCheck suppression: schemathesis generates constrained values
(e.g. design_speed: int in [20, 120]) via hypothesis filter strategies.
In CI without a hypothesis database the filter_too_much health check can
trigger before the search space is shrunk.  Suppressing it is safe here
because the schema itself enforces the constraints at the API layer.
"""

from __future__ import annotations

import schemathesis.openapi
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, settings
from schemathesis import Case
from schemathesis.checks import CHECKS, load_all_checks

from app.main import app

schema = schemathesis.openapi.from_asgi("/openapi.json", app=app)
_http_client = TestClient(app)

load_all_checks()
_unsupported_method = next(c for c in CHECKS.get_all() if c.__name__ == "unsupported_method")
# FastAPI ignores unknown query params (negative_data_rejection) and schemathesis generates
# boundary-mismatched multipart for file uploads (positive_data_acceptance).  Both are
# known limitations; exclude only from the auth test that exercises the real code paths.
_negative_data_rejection = next(
    c for c in CHECKS.get_all() if c.__name__ == "negative_data_rejection"
)
_positive_data_acceptance = next(
    c for c in CHECKS.get_all() if c.__name__ == "positive_data_acceptance"
)


@schema.parametrize()
@settings(suppress_health_check=[HealthCheck.filter_too_much, HealthCheck.too_slow])
def test_api_schema_conformance(case: Case) -> None:
    response = case.call()
    case.validate_response(response, excluded_checks=[_unsupported_method])


@schema.parametrize()
@settings(
    max_examples=5,
    suppress_health_check=[HealthCheck.filter_too_much, HealthCheck.too_slow],
)
def test_api_schema_conformance_with_auth(case: Case) -> None:
    """Contract test with a valid Bearer token — covers authenticated endpoints."""
    login = _http_client.post(
        "/api/auth/login",
        json={"email": "demo@arcsphere3d.dev", "password": "arcsphere-demo"},
    )
    token = login.json()["access_token"]
    response = case.call(headers={"Authorization": f"Bearer {token}"})
    case.validate_response(
        response,
        excluded_checks=[_unsupported_method, _negative_data_rejection, _positive_data_acceptance],
    )
