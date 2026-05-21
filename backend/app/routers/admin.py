"""Admin endpoints — restricted to admin-role users."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import AuditLogOut, CurrentUser, UserOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(current: CurrentUser = CurrentUserDep) -> CurrentUser:
    if current.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")
    return current


AdminDep = Depends(_require_admin)


@router.get(
    "/audit-logs",
    response_model=list[AuditLogOut],
    responses={
        401: {"description": "missing bearer token"},
        403: {"description": "admin role required"},
    },
)
async def get_audit_logs(
    db: DbDep,
    current: Annotated[CurrentUser, AdminDep],
    skip: int = Query(default=0, ge=0, le=2_147_483_647),
    limit: int = Query(default=100, ge=1, le=500),
    user_id: UUID | None = Query(default=None),
    action: str | None = Query(default=None),
) -> list[AuditLogOut]:
    """Return audit log entries (newest first). Admin only."""
    return await crud.list_audit_logs(db, skip=skip, limit=limit, user_id=user_id, action=action)


@router.get(
    "/users",
    response_model=list[UserOut],
    responses={
        401: {"description": "missing bearer token"},
        403: {"description": "admin role required"},
    },
)
async def list_users(
    db: DbDep,
    current: Annotated[CurrentUser, AdminDep],
    skip: int = Query(default=0, ge=0, le=2_147_483_647),
    limit: int = Query(default=50, ge=1, le=500),
) -> list[UserOut]:
    """Return all users (newest first). Admin only."""
    return await crud.list_users(db, skip=skip, limit=limit)


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"description": "missing bearer token"},
        403: {"description": "admin role required or attempting self-deletion"},
        404: {"description": "user not found"},
    },
)
async def delete_user(
    user_id: UUID,
    db: DbDep,
    current: Annotated[CurrentUser, AdminDep],
) -> None:
    """Delete a user by ID. Admin cannot delete themselves."""
    target = await crud.get_user_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    if target.email == current.sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="cannot delete your own account",
        )
    deleted = await crud.delete_user(db, user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    await crud.log_audit_event(
        db,
        action="user_deleted",
        user_id=None,
        resource_type="user",
        resource_id=str(user_id),
    )
    await db.commit()
