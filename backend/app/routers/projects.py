"""Project CRUD — backed by PostgreSQL via SQLAlchemy 2 async ORM."""

from __future__ import annotations

import io
import zipfile
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.db import crud
from app.deps import CurrentUserDep, DbDep
from app.s3 import get_object
from app.schemas import CurrentUser, ProjectCreate, ProjectOut, ProjectStats, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])

_Responses = dict[int | str, dict[str, Any]]

_400: _Responses = {400: {"description": "malformed request body"}}
_401: _Responses = {401: {"description": "missing or invalid bearer token"}}
_403: _Responses = {403: {"description": "insufficient role"}}
_404: _Responses = {404: {"description": "not found"}}

_ROLE_RANK = {"owner": 3, "editor": 2, "viewer": 1}


@router.get("", response_model=list[ProjectOut], responses=_401)
async def list_projects(
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
    skip: int = Query(default=0, ge=0, le=2_147_483_647),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[ProjectOut]:
    db_user = await crud.upsert_user(session, user)
    return await crud.list_projects(session, db_user.id, skip=skip, limit=limit)


@router.post(
    "", response_model=ProjectOut, status_code=status.HTTP_201_CREATED, responses={**_400, **_401}
)
async def create_project(
    body: ProjectCreate,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> ProjectOut:
    db_user = await crud.upsert_user(session, user)
    project = await crud.create_project(session, db_user.id, body)
    await crud.log_audit_event(
        session,
        action="project_created",
        user_id=db_user.id,
        resource_type="project",
        resource_id=str(project.id),
        detail=project.name,
    )
    await session.commit()
    return project


@router.get("/{project_id}", response_model=ProjectOut, responses={**_401, **_403, **_404})
async def get_project(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> ProjectOut:
    db_user = await crud.upsert_user(session, user)
    p = await crud.get_project(session, project_id, db_user.id)
    if p is not None:
        return ProjectOut(
            id=p.id,
            name=p.name,
            description=p.description,
            owner_id=p.owner_id,
            created_at=p.created_at,
        )
    role = await crud.get_member_role(session, project_id, db_user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    p = await crud.get_project_by_id(session, project_id)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description,
        owner_id=p.owner_id,
        created_at=p.created_at,
    )


@router.put(
    "/{project_id}",
    response_model=ProjectOut,
    responses={**_400, **_401, **_403, **_404},
)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> ProjectOut:
    """Rename a project. Owner and editor may rename; viewer gets 403."""
    db_user = await crud.upsert_user(session, user)
    role = await crud.get_access_role(session, project_id, db_user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    if role == "viewer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="editor or owner only")
    p = await crud.update_project(session, project_id, body.name, body.description)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    await crud.log_audit_event(
        session,
        action="project_updated",
        user_id=db_user.id,
        resource_type="project",
        resource_id=str(project_id),
        detail=body.name,
    )
    await session.commit()
    return ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description,
        owner_id=p.owner_id,
        created_at=p.created_at,
    )


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**_401, **_403, **_404},
)
async def delete_project(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> None:
    """Delete a project. Owner-only. Editor/viewer members receive 403.

    Cascade deletion of files and members is enforced by ON DELETE CASCADE
    at the database layer (see migration 0001_initial / project_member.py).
    """
    db_user = await crud.upsert_user(session, user)
    role = await crud.get_access_role(session, project_id, db_user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    if role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="owner only")
    await crud.delete_project(session, project_id, db_user.id)
    await crud.log_audit_event(
        session,
        action="project_deleted",
        user_id=db_user.id,
        resource_type="project",
        resource_id=str(project_id),
    )
    await session.commit()


@router.get(
    "/{project_id}/stats",
    response_model=ProjectStats,
    responses={**_401, **_403, **_404},
)
async def get_project_stats(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> ProjectStats:
    """Return aggregate counts (files, alignments, verticals, members) for the project."""
    db_user = await crud.upsert_user(session, user)
    role = await crud.get_access_role(session, project_id, db_user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")
    return await crud.get_project_stats(session, project_id)


@router.get(
    "/{project_id}/export",
    responses={**_401, **_403, **_404},
    response_class=StreamingResponse,
)
async def export_project(
    project_id: UUID,
    session: DbDep,
    user: CurrentUser = CurrentUserDep,
) -> StreamingResponse:
    """Export all project files as a ZIP archive. Any member (viewer+) may call this."""
    db_user = await crud.upsert_user(session, user)
    role = await crud.get_access_role(session, project_id, db_user.id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")

    project = await crud.get_project_by_id(session, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found")

    file_models = await crud.list_file_models(session, project_id)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in file_models:
            try:
                data = await get_object(f.s3_key)
            except Exception:  # noqa: BLE001, S112
                continue  # skip files that fail to fetch from S3
            zf.writestr(f.filename, data)

    buf.seek(0)

    safe_name = project.name.replace('"', "").replace("\\", "").replace("\n", "")
    await crud.log_audit_event(
        session,
        action="project_exported",
        user_id=db_user.id,
        resource_type="project",
        resource_id=str(project_id),
        detail=f"{len(file_models)} files",
    )
    await session.commit()

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'},
    )
