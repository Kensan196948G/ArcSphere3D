"""Tag and ProjectTag ORM models — project tagging system (Issue #229)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#6366f1")
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class ProjectTag(Base):
    __tablename__ = "project_tags"
    __table_args__ = (UniqueConstraint("project_id", "tag_id", name="uq_project_tags"),)

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[UUID] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
