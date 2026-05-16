"""Project CRUD (scaffold — in-memory until DB lands)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUserDep
from app.schemas import CurrentUser, ProjectCreate, ProjectOut

router = APIRouter(prefix="/api/projects", tags=["projects"])

_PROJECTS: dict[UUID, ProjectOut] = {}


@router.get("", response_model=list[ProjectOut])
def list_projects(user: CurrentUser = CurrentUserDep) -> list[ProjectOut]:
    # Ownership filter is a no-op in scaffold; user is required to enforce auth.
    _ = user
    return list(_PROJECTS.values())


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, user: CurrentUser = CurrentUserDep) -> ProjectOut:
    pid = uuid4()
    project = ProjectOut(
        id=pid,
        name=body.name,
        owner_id=UUID(int=hash(user.sub) & ((1 << 128) - 1)),
        created_at=datetime.now(UTC),
    )
    _PROJECTS[pid] = project
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: UUID, user: CurrentUser = CurrentUserDep) -> ProjectOut:
    _ = user
    p = _PROJECTS.get(project_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return p
