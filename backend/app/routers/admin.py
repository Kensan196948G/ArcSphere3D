"""Admin-only endpoints — audit logs, system management.

Access requires role='admin' (set on the User row at creation/seeding time).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import AuditLogOut, CurrentUser

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(user: CurrentUser) -> None:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin role required",
        )


@router.get(
    "/audit-logs",
    response_model=list[AuditLogOut],
    responses={
        401: {"description": "not authenticated"},
        403: {"description": "admin role required"},
    },
)
async def list_audit_logs(
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
    skip: int = Query(default=0, ge=0, le=2_147_483_647),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AuditLogOut]:
    """Return the most recent audit log entries (newest first)."""
    _require_admin(user)
    return await crud.list_audit_logs(session, skip=skip, limit=limit)
