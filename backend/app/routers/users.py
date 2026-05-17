"""User endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser

router = APIRouter(prefix="/api/users", tags=["users"])


class UserOut(BaseModel):
    id: UUID
    sub: str
    email: str
    role: str


@router.get("/me", response_model=UserOut, responses={401: {"description": "not authenticated"}})
async def get_me(
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> UserOut:
    """Return the authenticated user's DB record (includes UUID)."""
    db_user = await crud.upsert_user(session, user)
    return UserOut(id=db_user.id, sub=db_user.sub, email=db_user.email, role=db_user.role)
