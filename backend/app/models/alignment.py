"""Alignment ORM models — horizontal alignment (IP method) and vertical alignment (VIP method)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Alignment(Base):
    __tablename__ = "alignments"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    design_speed: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    ip_points: Mapped[list[AlignmentIpPoint]] = relationship(
        "AlignmentIpPoint",
        back_populates="alignment",
        cascade="all, delete-orphan",
        lazy="select",
        order_by="AlignmentIpPoint.seq",
    )


class AlignmentIpPoint(Base):
    """Horizontal alignment intersection point (IP method)."""

    __tablename__ = "alignment_ip_points"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    alignment_id: Mapped[UUID] = mapped_column(
        ForeignKey("alignments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    x: Mapped[float] = mapped_column(Numeric(precision=14, scale=4), nullable=False)
    z: Mapped[float] = mapped_column(Numeric(precision=14, scale=4), nullable=False)
    radius: Mapped[float] = mapped_column(Numeric(precision=10, scale=2), nullable=False)

    alignment: Mapped[Alignment] = relationship("Alignment", back_populates="ip_points")
