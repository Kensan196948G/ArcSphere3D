"""Project CRUD (scaffold — in-memory until DB lands).

Concurrency note: sync `def` routes run on Starlette's threadpool, so
`_PROJECTS` mutations are guarded by `_LOCK`. Replace this whole module
with a SQLAlchemy 2 + Postgres backend once the contract freezes.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from uuid import NAMESPACE_DNS, UUID, uuid4, uuid5

from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUserDep
from app.schemas import CurrentUser, ProjectCreate, ProjectOut

router = APIRouter(prefix="/api/projects", tags=["projects"])

_PROJECTS: dict[UUID, ProjectOut] = {}
_LOCK = threading.Lock()
_OWNER_NAMESPACE = uuid5(NAMESPACE_DNS, "arcsphere3d.dev/owner")


def _owner_id_for(user: CurrentUser) -> UUID:
    # Deterministic across processes/restarts (unlike Python's `hash()`,
    # which is randomised by PYTHONHASHSEED). uuid5 is stable so the same
    # `sub` claim always yields the same owner_id — required for the
    # in-memory store to survive uvicorn reloads and for the upcoming
    # Postgres migration to back-fill consistently.
    return uuid5(_OWNER_NAMESPACE, user.sub)


@router.get("", response_model=list[ProjectOut])
def list_projects(user: CurrentUser = CurrentUserDep) -> list[ProjectOut]:
    owner = _owner_id_for(user)
    with _LOCK:
        return [p for p in _PROJECTS.values() if p.owner_id == owner]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, user: CurrentUser = CurrentUserDep) -> ProjectOut:
    project = ProjectOut(
        id=uuid4(),
        name=body.name,
        owner_id=_owner_id_for(user),
        created_at=datetime.now(UTC),
    )
    with _LOCK:
        _PROJECTS[project.id] = project
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: UUID, user: CurrentUser = CurrentUserDep) -> ProjectOut:
    owner = _owner_id_for(user)
    with _LOCK:
        p = _PROJECTS.get(project_id)
    if not p or p.owner_id != owner:
        # Return 404 (not 403) to avoid leaking the existence of foreign IDs.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return p


def project_exists_for_owner(project_id: UUID, user: CurrentUser) -> bool:
    owner = _owner_id_for(user)
    with _LOCK:
        p = _PROJECTS.get(project_id)
    return p is not None and p.owner_id == owner
