"""Project CRUD — backed by PostgreSQL via SQLAlchemy 2 async ORM."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.schemas import CurrentUser, ProjectCreate, ProjectOut

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects(session: DbDep, user: CurrentUser = CurrentUserDep) -> list[ProjectOut]:
    db_user = await crud.upsert_user(session, user)
    return await crud.list_projects(session, db_user.id)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> ProjectOut:
    db_user = await crud.upsert_user(session, user)
    return await crud.create_project(session, db_user.id, body)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> ProjectOut:
    db_user = await crud.upsert_user(session, user)
    p = await crud.get_project(session, project_id, db_user.id)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return ProjectOut(id=p.id, name=p.name, owner_id=p.owner_id, created_at=p.created_at)
