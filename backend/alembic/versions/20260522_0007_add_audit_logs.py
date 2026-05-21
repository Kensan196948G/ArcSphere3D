"""add audit_logs table — append-only event record

Revision ID: 0007_add_audit_logs
Revises: 0006_backfill_owner_members
Create Date: 2026-05-22

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_add_audit_logs"
down_revision: str | None = "0006_backfill_owner_members"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("resource_type", sa.Text(), nullable=True),
        sa.Column("resource_id", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.Text(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("audit_logs_user_id_idx", "audit_logs", ["user_id"])
    op.create_index("audit_logs_action_idx", "audit_logs", ["action"])
    op.create_index("audit_logs_created_at_idx", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("audit_logs_created_at_idx", table_name="audit_logs")
    op.drop_index("audit_logs_action_idx", table_name="audit_logs")
    op.drop_index("audit_logs_user_id_idx", table_name="audit_logs")
    op.drop_table("audit_logs")
