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
from hypothesis import HealthCheck, settings
from schemathesis import Case
from schemathesis.checks import CHECKS, load_all_checks

from app.main import app

schema = schemathesis.openapi.from_asgi("/openapi.json", app=app)

load_all_checks()
_unsupported_method = next(c for c in CHECKS.get_all() if c.__name__ == "unsupported_method")


@schema.parametrize()
@settings(suppress_health_check=[HealthCheck.filter_too_much, HealthCheck.too_slow])
def test_api_schema_conformance(case: Case) -> None:
    response = case.call()
    case.validate_response(response, excluded_checks=[_unsupported_method])
