"""CRUD helpers — thin async SQLAlchemy wrappers used by routers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.user import User
from app.schemas import CurrentUser, ProjectCreate, ProjectOut


async def upsert_user(session: AsyncSession, current: CurrentUser) -> User:
    """Return the DB row for *current*, inserting it on first login."""
    result = await session.execute(select(User).where(User.sub == current.sub))
    db_user = result.scalar_one_or_none()
    if db_user is None:
        db_user = User(
            sub=current.sub,
            email=current.email or current.sub,
            role=current.role,
        )
        session.add(db_user)
        await session.commit()
        await session.refresh(db_user)
    return db_user


async def list_projects(session: AsyncSession, owner_id: UUID) -> list[ProjectOut]:
    result = await session.execute(select(Project).where(Project.owner_id == owner_id))
    return [
        ProjectOut(id=r.id, name=r.name, owner_id=r.owner_id, created_at=r.created_at)
        for r in result.scalars().all()
    ]


async def create_project(session: AsyncSession, owner_id: UUID, body: ProjectCreate) -> ProjectOut:
    project = Project(name=body.name, owner_id=owner_id)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return ProjectOut(
        id=project.id,
        name=project.name,
        owner_id=project.owner_id,
        created_at=project.created_at,
    )


async def get_project(session: AsyncSession, project_id: UUID, owner_id: UUID) -> Project | None:
    """Return the project if it belongs to *owner_id*, else None."""
    result = await session.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == owner_id)
    )
    return result.scalar_one_or_none()
