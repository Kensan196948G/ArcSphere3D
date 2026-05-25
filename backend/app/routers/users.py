"""User endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, EmailStr

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser, ProfilePatchRequest
from app.security import hash_password, verify_password

router = APIRouter(prefix="/api/users", tags=["users"])


class UserOut(BaseModel):
    id: UUID
    email: str
    role: str


class UserLookupOut(BaseModel):
    id: UUID
    email: str


@router.get("/me", response_model=UserOut, responses={401: {"description": "not authenticated"}})
async def get_me(
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> UserOut:
    """Return the authenticated user's DB record (includes UUID)."""
    db_user = await crud.upsert_user(session, user)
    return UserOut(id=db_user.id, email=db_user.email, role=db_user.role)


@router.patch(
    "/me",
    response_model=UserOut,
    responses={
        400: {"description": "wrong current password"},
        401: {"description": "not authenticated"},
        409: {"description": "email already in use"},
    },
)
async def patch_me(
    body: ProfilePatchRequest,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> UserOut:
    """Update the authenticated user's email and/or password."""
    db_user = await crud.upsert_user(session, user)

    if body.new_password is not None:
        if db_user.password_hash is None or not verify_password(
            body.current_password or "", db_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="wrong current password"
            )
        try:
            new_hash = hash_password(body.new_password)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        await crud.update_user_password(session, user_id=db_user.id, new_password_hash=new_hash)

    if body.email is not None:
        await crud.update_user_email(session, user_id=db_user.id, new_email=body.email)

    await session.commit()
    await session.refresh(db_user)
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
