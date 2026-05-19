"""User endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, EmailStr

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser

router = APIRouter(prefix="/api/users", tags=["users"])


class UserOut(BaseModel):
    id: UUID
    sub: str
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
    return UserOut(id=db_user.id, sub=db_user.sub, email=db_user.email, role=db_user.role)


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
