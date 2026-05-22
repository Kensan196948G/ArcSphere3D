"""CRUD helpers — thin async SQLAlchemy wrappers used by routers."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.alignment import (
    Alignment,
    AlignmentIpPoint,
    VerticalAlignment,
    VerticalAlignmentVip,
)
from app.models.audit_log import AuditLog
from app.models.file import File
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.user import User
from app.schemas import (
    AdminStats,
    AlignmentCreate,
    AlignmentOut,
    AuditLogOut,
    CurrentUser,
    FileMetadata,
    IpPointCreate,
    IpPointOut,
    MemberOut,
    ProjectCreate,
    ProjectOut,
    ProjectStats,
    UserOut,
    VerticalAlignmentCreate,
    VerticalAlignmentOut,
    VipCreate,
    VipOut,
)


async def upsert_user(session: AsyncSession, current: CurrentUser) -> User:
    """Return the DB row for the JWT-authenticated *current* user.

    Post Issue #180 `current.sub` is guaranteed to be a UUID — `get_current_user`
    rejects non-UUID subjects centrally — so this function does a pure primary
    key lookup and no longer creates rows from JWT context. Row creation
    belongs in registration paths (password signup, admin user creation, SSO
    bootstrap) where identity is established before a token is issued.

    Failing closed on a malformed sub (defense in depth) and on a missing row
    (deleted user with a still-valid token) closes the email-fallback bypass
    surfaced by adversarial review and removes the SELECT-then-INSERT race
    that the previous dual-lookup widened.
    """
    try:
        user_uuid = UUID(current.sub)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token subject is not a user UUID",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    result = await session.execute(select(User).where(User.id == user_uuid))
    db_user = result.scalar_one_or_none()
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return db_user


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    """Return the DB row for a user with *email*, or None if not found."""
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user_with_password(
    session: AsyncSession,
    *,
    email: str,
    password_hash: str,
    role: str = "viewer",
) -> UserOut:
    """Create a new DB-backed user with a bcrypt password hash."""
    user = User(sub=email, email=email, role=role, password_hash=password_hash)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserOut(id=user.id, email=user.email, role=user.role, created_at=user.created_at)


async def get_or_create_db_user(
    session: AsyncSession,
    *,
    email: str,
    password_hash: str,
    role: str = "viewer",
) -> User:
    """Upsert a DB user by email — idempotent, safe under concurrent calls."""
    stmt = (
        pg_insert(User)
        .values(sub=email, email=email, role=role, password_hash=password_hash)
        .on_conflict_do_update(
            index_elements=["email"],
            set_={"password_hash": password_hash, "role": role},
        )
        .returning(User)
    )
    result = await session.execute(stmt)
    user = result.scalar_one()
    await session.commit()
    return user


async def update_user_password(
    session: AsyncSession,
    *,
    user_id: UUID,
    new_password_hash: str,
) -> None:
    """Update the bcrypt password hash for *user_id*. Caller commits."""
    await session.execute(
        update(User).where(User.id == user_id).values(password_hash=new_password_hash)
    )


async def list_projects(
    session: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 50
) -> list[ProjectOut]:
    """Return projects owned by *user_id* OR where *user_id* is a member."""
    result = await session.execute(
        select(Project)
        .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
        .where(or_(Project.owner_id == user_id, ProjectMember.user_id == user_id))
        .distinct()
        .offset(skip)
        .limit(limit)
    )
    return [
        ProjectOut(id=r.id, name=r.name, owner_id=r.owner_id, created_at=r.created_at)
        for r in result.scalars().all()
    ]


async def create_project(session: AsyncSession, owner_id: UUID, body: ProjectCreate) -> ProjectOut:
    project = Project(name=body.name, owner_id=owner_id)
    session.add(project)
    await session.flush()  # get project.id before adding member row
    owner_member = ProjectMember(project_id=project.id, user_id=owner_id, role="owner")
    session.add(owner_member)
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


async def get_project_by_id(session: AsyncSession, project_id: UUID) -> Project | None:
    """Return the project regardless of ownership (used for member-based access)."""
    result = await session.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def update_project_name(session: AsyncSession, project_id: UUID, name: str) -> Project | None:
    """Rename a project. Returns None if the project does not exist."""
    p = await get_project_by_id(session, project_id)
    if p is None:
        return None
    p.name = name
    await session.commit()
    await session.refresh(p)
    return p


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


async def get_file_by_id(session: AsyncSession, file_id: UUID) -> File | None:
    """Return the file regardless of project ownership (used with RBAC member access)."""
    result = await session.execute(select(File).where(File.id == file_id))
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


# ---- Project Members (RBAC) ----


async def count_owners(session: AsyncSession, project_id: UUID) -> int:
    """Return the number of members with role='owner' for *project_id*."""
    from sqlalchemy import func

    result = await session.execute(
        select(func.count())
        .select_from(ProjectMember)
        .where(
            ProjectMember.project_id == project_id,
            ProjectMember.role == "owner",
        )
    )
    return result.scalar_one()


async def get_member_role(session: AsyncSession, project_id: UUID, user_id: UUID) -> str | None:
    """Return the role of *user_id* in *project_id*, or None if not a member."""
    result = await session.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    return row.role if row else None


async def get_access_role(session: AsyncSession, project_id: UUID, user_id: UUID) -> str | None:
    """Return the effective role of *user_id* on *project_id*.

    Resolves to one of:
      - "owner"   when the user owns the project (projects.owner_id match);
      - "editor"  or "viewer" when registered in project_members;
      - None      when the project does not exist or the user has no access.

    Distinguishing "no access" (None) from "member but not owner" lets the
    router return 404 vs 403 correctly — the 3-tier RBAC requirement of #61.
    """
    project = await get_project_by_id(session, project_id)
    if project is None:
        return None
    if project.owner_id == user_id:
        return "owner"
    return await get_member_role(session, project_id, user_id)


async def delete_project(session: AsyncSession, project_id: UUID, owner_id: UUID) -> bool:
    """Delete a project owned by *owner_id*.

    Returns True on success, False if the project does not exist or is not
    owned by *owner_id*. Cascade deletion of files/members is enforced by
    SQLAlchemy relationships and DB-level ON DELETE CASCADE.
    """
    project = await get_project(session, project_id, owner_id)
    if project is None:
        return False
    await session.delete(project)
    await session.commit()
    return True


async def list_members(session: AsyncSession, project_id: UUID) -> list[MemberOut]:
    result = await session.execute(
        select(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
    )
    return [
        MemberOut(
            project_id=m.project_id,
            user_id=m.user_id,
            email=u.email,
            role=m.role,
            created_at=m.created_at,
        )
        for m, u in result.all()
    ]


async def add_member(
    session: AsyncSession, project_id: UUID, user_id: UUID, role: str
) -> MemberOut | None:
    """Add or update *user_id*'s role on *project_id*.

    Returns None when *user_id* does not refer to an existing user — that
    case used to surface as a PostgreSQL FK violation and propagate as a
    500. Routers translate None into a clean 404.
    """
    user_result = await session.execute(select(User).where(User.id == user_id))
    db_user = user_result.scalar_one_or_none()
    if db_user is None:
        return None

    existing = await session.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = existing.scalar_one_or_none()
    if member is None:
        member = ProjectMember(project_id=project_id, user_id=user_id, role=role)
        session.add(member)
    else:
        member.role = role
    await session.commit()
    await session.refresh(member)
    return MemberOut(
        project_id=member.project_id,
        user_id=member.user_id,
        email=db_user.email,
        role=member.role,
        created_at=member.created_at,
    )


async def remove_member(session: AsyncSession, project_id: UUID, user_id: UUID) -> bool | None:
    """Delete the membership.

    Returns:
        True   – removed successfully
        False  – member not found
        None   – last-owner protection triggered (caller should return 409)
    """
    result = await session.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        return False
    if member.role == "owner" and await count_owners(session, project_id) <= 1:
        return None  # last-owner guard
    await session.delete(member)
    await session.commit()
    return True


# ---- Vertical Alignment CRUD ----


def _vip_to_out(v: VerticalAlignmentVip) -> VipOut:
    return VipOut(
        id=v.id,
        vertical_alignment_id=v.vertical_alignment_id,
        seq=v.seq,
        station=float(v.station),
        elevation=float(v.elevation),
        vc_length=float(v.vc_length),
    )


def vertical_to_out(va: VerticalAlignment) -> VerticalAlignmentOut:
    return VerticalAlignmentOut(
        id=va.id,
        alignment_id=va.alignment_id,
        name=va.name,
        created_at=va.created_at,
        vips=[_vip_to_out(v) for v in sorted(va.vips, key=lambda v: v.seq)],
    )


async def list_verticals(
    session: AsyncSession, alignment_id: UUID, skip: int = 0, limit: int = 100
) -> list[VerticalAlignmentOut]:
    result = await session.execute(
        select(VerticalAlignment)
        .where(VerticalAlignment.alignment_id == alignment_id)
        .options(selectinload(VerticalAlignment.vips))
        .offset(skip)
        .limit(limit)
    )
    return [vertical_to_out(va) for va in result.scalars().all()]


async def create_vertical(
    session: AsyncSession, alignment_id: UUID, body: VerticalAlignmentCreate
) -> VerticalAlignmentOut:
    va = VerticalAlignment(alignment_id=alignment_id, name=body.name)
    session.add(va)
    await session.commit()
    await session.refresh(va, ["vips"])
    return vertical_to_out(va)


async def get_vertical(
    session: AsyncSession, vertical_id: UUID, alignment_id: UUID
) -> VerticalAlignment | None:
    result = await session.execute(
        select(VerticalAlignment)
        .where(
            VerticalAlignment.id == vertical_id,
            VerticalAlignment.alignment_id == alignment_id,
        )
        .options(selectinload(VerticalAlignment.vips))
    )
    return result.scalar_one_or_none()


async def delete_vertical(session: AsyncSession, vertical_id: UUID) -> None:
    result = await session.execute(
        select(VerticalAlignment).where(VerticalAlignment.id == vertical_id)
    )
    va = result.scalar_one_or_none()
    if va:
        await session.delete(va)
        await session.commit()


async def upsert_vips(
    session: AsyncSession, vertical_id: UUID, points: list[VipCreate]
) -> list[VipOut]:
    """Replace all VIPs for the vertical alignment with the supplied list."""
    existing = await session.execute(
        select(VerticalAlignmentVip).where(
            VerticalAlignmentVip.vertical_alignment_id == vertical_id
        )
    )
    for old in existing.scalars().all():
        await session.delete(old)

    new_vips: list[VerticalAlignmentVip] = []
    for p in points:
        vip = VerticalAlignmentVip(
            vertical_alignment_id=vertical_id,
            seq=p.seq,
            station=p.station,
            elevation=p.elevation,
            vc_length=p.vc_length,
        )
        session.add(vip)
        new_vips.append(vip)

    await session.commit()
    for vip in new_vips:
        await session.refresh(vip)

    return [_vip_to_out(v) for v in sorted(new_vips, key=lambda v: v.seq)]


async def get_project_stats(session: AsyncSession, project_id: UUID) -> ProjectStats:
    """Return aggregate counts for *project_id*."""
    file_count = (
        await session.execute(
            select(func.count()).select_from(File).where(File.project_id == project_id)
        )
    ).scalar_one()
    alignment_count = (
        await session.execute(
            select(func.count()).select_from(Alignment).where(Alignment.project_id == project_id)
        )
    ).scalar_one()
    vertical_count = (
        await session.execute(
            select(func.count())
            .select_from(VerticalAlignment)
            .join(Alignment, Alignment.id == VerticalAlignment.alignment_id)
            .where(Alignment.project_id == project_id)
        )
    ).scalar_one()
    member_count = (
        await session.execute(
            select(func.count())
            .select_from(ProjectMember)
            .where(ProjectMember.project_id == project_id)
        )
    ).scalar_one()
    return ProjectStats(
        file_count=file_count,
        alignment_count=alignment_count,
        vertical_count=vertical_count,
        member_count=member_count,
    )


# ---- Audit Logs ----


async def log_audit_event(
    session: AsyncSession,
    *,
    action: str,
    user_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    detail: str | None = None,
) -> None:
    """Append a single audit event row (fire-and-forget; caller commits)."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        detail=detail,
    )
    session.add(entry)


async def list_audit_logs(
    session: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 100,
    user_id: UUID | None = None,
    action: str | None = None,
) -> list[AuditLogOut]:
    """Return audit log entries, newest first. Owner/admin only — callers must check RBAC."""
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if action is not None:
        stmt = stmt.where(AuditLog.action == action)
    result = await session.execute(stmt)
    return [
        AuditLogOut(
            id=r.id,
            user_id=r.user_id,
            action=r.action,
            resource_type=r.resource_type,
            resource_id=r.resource_id,
            ip_address=r.ip_address,
            detail=r.detail,
            created_at=r.created_at,
        )
        for r in result.scalars().all()
    ]


# ---- Admin: User Management ----


async def list_users(
    session: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
) -> list[UserOut]:
    """Return all users (admin only — callers must check RBAC)."""
    result = await session.execute(
        select(User).order_by(User.created_at.asc()).offset(skip).limit(limit)
    )
    return [
        UserOut(id=u.id, email=u.email, role=u.role, created_at=u.created_at)
        for u in result.scalars().all()
    ]


async def get_user_by_id(session: AsyncSession, user_id: UUID) -> User | None:
    """Return the DB row for *user_id*, or None if not found."""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_id_for_update(session: AsyncSession, user_id: UUID) -> User | None:
    """Return the DB row for *user_id* under a row-level lock (``SELECT ... FOR UPDATE``).

    Issue #180 round-5 hardening: closes a TOCTOU race between the admin gate and the
    privileged write. ``_require_admin`` reloads the actor row to validate role, but a
    plain ``SELECT`` does not prevent a concurrent admin from demoting/deleting that
    actor before the handler's ``UPDATE``/``DELETE`` commits. Acquiring ``FOR UPDATE``
    on the actor row holds an exclusive lock for the lifetime of the request
    transaction (DbDep is request-scoped, one session per request), so any concurrent
    role change or deletion of this actor blocks until the current admin mutation
    commits — making revocation effective immediately, not "eventually consistent".
    """
    result = await session.execute(select(User).where(User.id == user_id).with_for_update())
    return result.scalar_one_or_none()


async def lock_user_pair_for_update(
    session: AsyncSession,
    *,
    actor_id: UUID,
    target_id: UUID,
) -> tuple[User | None, User | None]:
    """Lock the actor and target ``users`` rows for the current transaction in UUID order.

    Returns ``(actor, target)`` (either may be ``None`` if the row no longer exists).
    When ``actor_id == target_id`` the same row is returned in both slots (one lock).

    Issue #180 round-6 hardening: prevents cross-admin deadlock. The round-5 fix took
    ``FOR UPDATE`` on the actor row inside the dependency, then handlers later updated
    or deleted the target row. PostgreSQL row locks under that scheme establish a
    request-specific lock order ``(actor, target)``, so two admins acting on each
    other (A demotes/deletes B while B demotes/deletes A concurrently) form a cycle:
    request 1 holds A waits B; request 2 holds B waits A — Postgres aborts one with
    ``40P01 deadlock_detected``.

    Locking both rows together in **UUID order** (a total order across all
    transactions) makes the lock-acquisition graph acyclic by construction: every
    admin mutation, regardless of who the actor or target is, takes the row with the
    smaller UUID first, so two concurrent admin-on-admin requests serialize through
    the lower-UUID row instead of deadlocking. Self-mutations (``actor_id ==
    target_id``) take a single lock — there is no second row to deadlock against.

    Callers (admin mutation handlers) must re-check ``actor.role == "admin"`` *after*
    this returns: that re-check under the lock is what makes the gate atomic with the
    write, since ``_require_admin`` itself no longer locks (it cannot, without
    re-introducing the deadlock).
    """
    if actor_id == target_id:
        row = await get_user_by_id_for_update(session, actor_id)
        return row, row

    first_id, second_id = sorted([actor_id, target_id])
    first_row = await get_user_by_id_for_update(session, first_id)
    second_row = await get_user_by_id_for_update(session, second_id)
    if actor_id == first_id:
        return first_row, second_row
    return second_row, first_row


async def delete_user(session: AsyncSession, user_id: UUID) -> bool:
    """Delete *user_id* and all their data. Returns False if user not found."""
    user = await get_user_by_id(session, user_id)
    if user is None:
        return False
    await session.delete(user)
    return True


async def update_user_role(
    session: AsyncSession,
    *,
    user_id: UUID,
    new_role: str,
) -> UserOut | None:
    """Update the role for *user_id*. Returns None if user not found. Caller commits."""
    user = await get_user_by_id(session, user_id)
    if user is None:
        return None
    await session.execute(update(User).where(User.id == user_id).values(role=new_role))
    return UserOut(id=user.id, email=user.email, role=new_role, created_at=user.created_at)


# ---- Admin: Dashboard Stats ----


async def get_admin_stats(session: AsyncSession) -> AdminStats:
    """Return aggregate counts across all users, projects, files, and audit events."""
    user_count = (await session.execute(select(func.count()).select_from(User))).scalar_one()
    project_count = (await session.execute(select(func.count()).select_from(Project))).scalar_one()
    file_count = (await session.execute(select(func.count()).select_from(File))).scalar_one()
    audit_count = (await session.execute(select(func.count()).select_from(AuditLog))).scalar_one()
    return AdminStats(
        total_users=user_count,
        total_projects=project_count,
        total_files=file_count,
        total_audit_events=audit_count,
    )
