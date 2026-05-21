"""AuditLog ORM model — append-only event record."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Text, event, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[UUID | None] = mapped_column(nullable=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    resource_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


# Enforce append-only at the ORM layer — no UPDATE or DELETE allowed.
@event.listens_for(AuditLog, "before_update")
def _block_update(mapper, connection, target):  # type: ignore[no-untyped-def]
    raise RuntimeError("audit_logs is append-only — UPDATE is forbidden")


@event.listens_for(AuditLog, "before_delete")
def _block_delete(mapper, connection, target):  # type: ignore[no-untyped-def]
    raise RuntimeError("audit_logs is append-only — DELETE is forbidden")
