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
    """Admin gate that authorizes from *live* DB state.

    Issue #180 round-4 hardening: a stateless JWT's `role` claim cannot reflect
    revocation — a token minted while the user was an admin remains valid (and
    self-asserts `role=admin`) until `exp`, so a deleted or demoted admin could
    otherwise keep calling admin endpoints for the rest of the access-token
    lifetime. By re-loading the actor row on every protected request and
    authorizing from `db_user.role`, revocation takes effect immediately for
    read-only admin endpoints (list_users, get_admin_stats, list_audit_logs).

    Mutation handlers (delete_user, update_user_role, reset_user_password)
    additionally re-check the actor under a row lock taken in UUID order with
    the target row — see `crud.lock_user_pair_for_update`. That second check
    is what closes the TOCTOU window for privileged writes; the gate alone is
    "best-effort live", and intentionally takes no lock here to avoid a cross-
    admin deadlock (round 6: locking actor-first in the dep then target-later
    in the handler creates a circular wait when two admins act on each other).
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


def _ensure_admin_under_lock(actor: object) -> None:
    """Re-validate the actor's admin role **after** taking the per-request row lock.

    Issue #180 round-6: ``_require_admin`` performs a best-effort live check without
    a row lock (locking there caused a cross-admin deadlock — see
    ``crud.lock_user_pair_for_update``). Mutation handlers therefore re-take the
    actor row under ``FOR UPDATE`` (paired with the target row in UUID order) and
    re-check the role here, *inside* the request's transaction. Combined with the
    row lock, this re-check makes the gate atomic with the write: a concurrent
    admin who demotes or deletes this actor will be serialized behind the lock and
    observed here as ``role != "admin"`` or ``actor is None``, causing the
    privileged mutation to abort before it commits.
    """
    if actor is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if getattr(actor, "role", None) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin role required",
        )


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
    response_model=None,
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
    actor, target = await crud.lock_user_pair_for_update(
        db, actor_id=UUID(current.sub), target_id=user_id
    )
    _ensure_admin_under_lock(actor)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    if str(target.id) == current.sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="cannot delete your own account",
        )
    await crud.delete_user(db, user_id, locked_user=target)
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
    actor, target = await crud.lock_user_pair_for_update(
        db, actor_id=UUID(current.sub), target_id=user_id
    )
    _ensure_admin_under_lock(actor)
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
    response_model=None,
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

    actor, target = await crud.lock_user_pair_for_update(
        db, actor_id=UUID(current.sub), target_id=user_id
    )
    _ensure_admin_under_lock(actor)
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
