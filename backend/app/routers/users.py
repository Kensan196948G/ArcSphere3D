"""User endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, field_validator

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser, ExistingPassword, NewPassword
from app.security import hash_password, verify_password

router = APIRouter(prefix="/api/users", tags=["users"])


class UserOut(BaseModel):
    id: UUID
    email: str
    role: str


class UserLookupOut(BaseModel):
    id: UUID
    email: str


class ProfilePatchRequest(BaseModel):
    email: EmailStr | None = None
    current_password: ExistingPassword | None = None
    new_password: NewPassword | None = None

    @field_validator("new_password")
    @classmethod
    def _require_current_when_new(cls, v: str | None, info: object) -> str | None:
        data = getattr(info, "data", {})
        if v is not None and not data.get("current_password"):
            raise ValueError("current_password is required when changing password")
        return v


@router.get("/me", response_model=UserOut, responses={401: {"description": "not authenticated"}})
async def get_me(
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> UserOut:
    """Return the authenticated user's DB record (includes UUID)."""
    db_user = await crud.upsert_user(session, user)
    return UserOut(id=db_user.id, email=db_user.email, role=db_user.role)


@router.get(
    "/lookup",
    response_model=UserLookupOut,
    responses={
        401: {"description": "not authenticated"},
        404: {"description": "user not found"},
    },
)
async def lookup_user(
    session: DbDep,
    email: EmailStr = Query(..., description="Email address to look up"),
    user: CurrentUser = CurrentUserDep,
) -> UserLookupOut:
    """Look up a user by email address. Returns id + email only."""
    _ = user  # auth guard — any authenticated user may call this
    db_user = await crud.get_user_by_email(session, email)
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    return UserLookupOut(id=db_user.id, email=db_user.email)


@router.patch(
    "/me",
    response_model=UserOut,
    responses={
        400: {"description": "validation error"},
        401: {"description": "not authenticated or wrong password"},
        409: {"description": "email already in use"},
    },
)
async def patch_me(
    body: ProfilePatchRequest,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> UserOut:
    """Update email and/or password for the authenticated user."""
    from uuid import UUID as _UUID

    user_id = _UUID(user.sub)
    db_user = await crud.get_user_by_id(session, user_id)
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")

    if body.new_password is not None:
        if db_user.password_hash is None or not verify_password(
            body.current_password or "", db_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="current password is incorrect",
            )
        await crud.update_user_password(
            session, user_id=user_id, new_password_hash=hash_password(body.new_password)
        )

    if body.email is not None and body.email != db_user.email:
        await crud.update_user_email(session, user_id=user_id, new_email=body.email)

    await session.commit()
    refreshed = await crud.get_user_by_id(session, user_id)
    assert refreshed is not None
    return UserOut(id=refreshed.id, email=refreshed.email, role=refreshed.role)
