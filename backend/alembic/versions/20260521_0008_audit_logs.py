"""create audit_logs table — append-only security event log

Revision ID: 0008_audit_logs
Revises: 0007_auth_refresh_tokens
Create Date: 2026-05-21

Implements Issue #129. Records security-relevant events (login, project CRUD,
file uploads, member changes) for 90-day retention.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_audit_logs"
down_revision: str | None = "0007_auth_refresh_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True
        ),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource_type", sa.String(32), nullable=False),
        sa.Column("resource_id", sa.String(64), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="SET NULL", name="audit_logs_user_id_fkey"
        ),
    )
    op.create_index("audit_logs_user_id_idx", "audit_logs", ["user_id"])
    op.create_index("audit_logs_created_at_idx", "audit_logs", ["created_at"])
    op.create_index("audit_logs_action_idx", "audit_logs", ["action"])


def downgrade() -> None:
    op.drop_table("audit_logs")
