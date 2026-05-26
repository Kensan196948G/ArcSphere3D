"""Tag and ProjectTag ORM models."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, String, Table, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

project_tags = Table(
    "project_tags",
    Base.metadata,
    sa.Column(
        "project_id", sa.UUID(), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    ),
    sa.Column("tag_id", sa.UUID(), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    color: Mapped[str] = mapped_column(String(7), nullable=False, server_default="#6366f1")
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
