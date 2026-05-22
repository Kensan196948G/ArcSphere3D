"""Admin endpoints — restricted to admin-role users."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import (
    AdminPasswordReset,
    AdminStats,
    AuditLogOut,
    CurrentUser,
    UserCreate,
    UserOut,
    UserRoleUpdate,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def _require_admin(
    db: DbDep,
    current: CurrentUser = CurrentUserDep,
) -> CurrentUser:
    """Admin gate that authorizes from *live* DB state, not stale JWT claims.

    Issue #180 round-4 hardening: a stateless JWT's `role` claim cannot reflect
    revocation — a token minted while the user was an admin remains valid (and
    self-asserts `role=admin`) until `exp`, so a deleted or demoted admin could
    otherwise keep calling admin endpoints for the rest of the access-token
    lifetime. By re-loading the actor row on every protected request and
    authorizing from `db_user.role`, revocation takes effect immediately for
    privileged operations.
    """
    db_user = await crud.get_user_by_id(db, UUID(current.sub))
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if db_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin role required")
    # Reflect live role on the dependency object so handlers see authoritative
    # state (defense in depth — handlers should not check role separately, but
    # if they do, they read the DB value, not the token).
    return CurrentUser(sub=current.sub, email=current.email, role=db_user.role)


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
    "/stats",
    response_model=AdminStats,
    responses={
        401: {"description": "missing bearer token"},
        403: {"description": "admin role required"},
    },
)
async def get_admin_stats(
    db: DbDep,
    current: Annotated[CurrentUser, AdminDep],
) -> AdminStats:
    """Return aggregate counts across users, projects, files, and audit events. Admin only."""
    return await crud.get_admin_stats(db)


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


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "malformed request body"},
        401: {"description": "missing bearer token"},
        403: {"description": "admin role required"},
        409: {"description": "email already in use"},
    },
)
async def create_user(
    body: UserCreate,
    db: DbDep,
    current: Annotated[CurrentUser, AdminDep],
) -> UserOut:
    """Create a new user with a bcrypt-hashed password. Admin only."""
    from app.security import hash_password

    existing = await crud.get_user_by_email(db, body.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email already in use",
        )
    user = await crud.create_user_with_password(
        db,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    await crud.log_audit_event(
        db,
        action="user_created",
        resource_type="user",
        resource_id=str(user.id),
    )
    await db.commit()
    return user


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
    if str(target.id) == current.sub:
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
        user_id=UUID(current.sub),
        resource_type="user",
        resource_id=str(user_id),
    )
    await db.commit()


@router.patch(
    "/users/{user_id}/role",
    response_model=UserOut,
    responses={
        400: {"description": "malformed request body"},
        401: {"description": "missing bearer token"},
        403: {"description": "admin role required or attempting self-demotion"},
        404: {"description": "user not found"},
    },
)
async def update_user_role(
    user_id: UUID,
    body: UserRoleUpdate,
    db: DbDep,
    current: Annotated[CurrentUser, AdminDep],
) -> UserOut:
    """Change a user's role. Admin cannot demote themselves."""
    target = await crud.get_user_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    if str(target.id) == current.sub and body.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="cannot demote your own admin role",
        )
    result = await crud.update_user_role(db, user_id=user_id, new_role=body.role)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    await crud.log_audit_event(
        db,
        action="user_role_changed",
        user_id=UUID(current.sub),
        resource_type="user",
        resource_id=str(user_id),
        detail=f"role changed to {body.role}",
    )
    await db.commit()
    return result


@router.post(
    "/users/{user_id}/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        400: {"description": "malformed request body"},
        401: {"description": "missing bearer token"},
        403: {"description": "admin role required"},
        404: {"description": "user not found or has no DB password"},
    },
)
async def reset_user_password(
    user_id: UUID,
    body: AdminPasswordReset,
    db: DbDep,
    current: Annotated[CurrentUser, AdminDep],
) -> None:
    """Reset any user's password. Admin only — no current-password check."""
    from app.security import hash_password

    target = await crud.get_user_by_id(db, user_id)
    if target is None or not target.password_hash:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found or has no DB password (SSO-only account)",
        )
    new_hash = hash_password(body.new_password)
    await crud.update_user_password(db, user_id=user_id, new_password_hash=new_hash)
    await crud.log_audit_event(
        db,
        action="password_reset_by_admin",
        user_id=UUID(current.sub),
        resource_type="user",
        resource_id=str(user_id),
        detail=f"reset by admin {current.email or current.sub}",
    )
    await db.commit()
