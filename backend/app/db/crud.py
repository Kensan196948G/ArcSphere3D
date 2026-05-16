"""CRUD helpers — thin async SQLAlchemy wrappers used by routers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.alignment import Alignment, AlignmentIpPoint
from app.models.file import File
from app.models.project import Project
from app.models.user import User
from app.schemas import (
    AlignmentCreate,
    AlignmentOut,
    CurrentUser,
    FileMetadata,
    IpPointCreate,
    IpPointOut,
    ProjectCreate,
    ProjectOut,
)


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


async def list_projects(
    session: AsyncSession, owner_id: UUID, skip: int = 0, limit: int = 50
) -> list[ProjectOut]:
    result = await session.execute(
        select(Project).where(Project.owner_id == owner_id).offset(skip).limit(limit)
    )
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


async def create_file(
    session: AsyncSession,
    project_id: UUID,
    filename: str,
    size_bytes: int,
    content_type: str,
    s3_key: str,
    sha256: bytes,
) -> File:
    f = File(
        project_id=project_id,
        filename=filename,
        size_bytes=size_bytes,
        content_type=content_type,
        s3_key=s3_key,
        sha256=sha256,
    )
    session.add(f)
    await session.commit()
    await session.refresh(f)
    return f


async def list_files(
    session: AsyncSession, project_id: UUID, skip: int = 0, limit: int = 50
) -> list[FileMetadata]:
    result = await session.execute(
        select(File).where(File.project_id == project_id).offset(skip).limit(limit)
    )
    return [
        FileMetadata(
            id=r.id,
            project_id=r.project_id,
            filename=r.filename,
            size_bytes=r.size_bytes,
            content_type=r.content_type,
            uploaded_at=r.uploaded_at,
        )
        for r in result.scalars().all()
    ]


async def get_file_by_sha256(session: AsyncSession, project_id: UUID, sha256: bytes) -> File | None:
    """Return existing file row if the same content was already uploaded to this project."""
    result = await session.execute(
        select(File).where(File.project_id == project_id, File.sha256 == sha256)
    )
    return result.scalar_one_or_none()


async def get_file(session: AsyncSession, file_id: UUID, project_id: UUID) -> File | None:
    result = await session.execute(
        select(File).where(File.id == file_id, File.project_id == project_id)
    )
    return result.scalar_one_or_none()


async def get_file_owned_by(session: AsyncSession, file_id: UUID, owner_id: UUID) -> File | None:
    """Return the file row only if it belongs to a project owned by *owner_id* (IDOR defense)."""
    result = await session.execute(
        select(File)
        .join(Project, File.project_id == Project.id)
        .where(File.id == file_id, Project.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def delete_file(session: AsyncSession, file_id: UUID) -> None:
    result = await session.execute(select(File).where(File.id == file_id))
    f = result.scalar_one_or_none()
    if f:
        await session.delete(f)
        await session.commit()


# ---- Alignment CRUD ----


def alignment_to_out(a: Alignment) -> AlignmentOut:
    return AlignmentOut(
        id=a.id,
        project_id=a.project_id,
        name=a.name,
        design_speed=a.design_speed,
        created_at=a.created_at,
        ip_points=[
            IpPointOut(
                id=p.id,
                alignment_id=p.alignment_id,
                seq=p.seq,
                x=float(p.x),
                z=float(p.z),
                radius=float(p.radius),
            )
            for p in sorted(a.ip_points, key=lambda ip: ip.seq)
        ],
    )


async def list_alignments(
    session: AsyncSession, project_id: UUID, skip: int = 0, limit: int = 100
) -> list[AlignmentOut]:
    result = await session.execute(
        select(Alignment)
        .where(Alignment.project_id == project_id)
        .options(selectinload(Alignment.ip_points))
        .offset(skip)
        .limit(limit)
    )
    return [alignment_to_out(a) for a in result.scalars().all()]


async def create_alignment(
    session: AsyncSession, project_id: UUID, body: AlignmentCreate
) -> AlignmentOut:
    a = Alignment(project_id=project_id, name=body.name, design_speed=body.design_speed)
    session.add(a)
    await session.commit()
    await session.refresh(a, ["ip_points"])
    return alignment_to_out(a)


async def get_alignment(
    session: AsyncSession, alignment_id: UUID, project_id: UUID
) -> Alignment | None:
    result = await session.execute(
        select(Alignment)
        .where(Alignment.id == alignment_id, Alignment.project_id == project_id)
        .options(selectinload(Alignment.ip_points))
    )
    return result.scalar_one_or_none()


async def delete_alignment(session: AsyncSession, alignment_id: UUID) -> None:
    result = await session.execute(select(Alignment).where(Alignment.id == alignment_id))
    a = result.scalar_one_or_none()
    if a:
        await session.delete(a)
        await session.commit()


async def upsert_ip_points(
    session: AsyncSession, alignment_id: UUID, points: list[IpPointCreate]
) -> list[IpPointOut]:
    """Replace all IP points for the alignment with the supplied list."""
    existing = await session.execute(
        select(AlignmentIpPoint).where(AlignmentIpPoint.alignment_id == alignment_id)
    )
    for old in existing.scalars().all():
        await session.delete(old)

    new_points: list[AlignmentIpPoint] = []
    for p in points:
        ip = AlignmentIpPoint(
            alignment_id=alignment_id,
            seq=p.seq,
            x=p.x,
            z=p.z,
            radius=p.radius,
        )
        session.add(ip)
        new_points.append(ip)

    await session.commit()
    for ip in new_points:
        await session.refresh(ip)

    return [
        IpPointOut(
            id=ip.id,
            alignment_id=ip.alignment_id,
            seq=ip.seq,
            x=float(ip.x),
            z=float(ip.z),
            radius=float(ip.radius),
        )
        for ip in sorted(new_points, key=lambda x: x.seq)
    ]
