"""add user_notifications table

Revision ID: 0012_add_user_notifications
Revises: 0009_drop_users_sub_column
Create Date: 2026-05-26

Issue #227: persistent notification inbox.
Notifications are written by the WS manager and consumed via REST API.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0012_add_user_notifications"
down_revision = "0009_drop_users_sub_column"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_notifications",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_user_notifications_user_id_created",
        "user_notifications",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_user_notifications_user_id_unread",
        "user_notifications",
        ["user_id", "is_read"],
        postgresql_where=sa.text("NOT is_read"),
    )


def downgrade() -> None:
    op.drop_index("ix_user_notifications_user_id_unread", table_name="user_notifications")
    op.drop_index("ix_user_notifications_user_id_created", table_name="user_notifications")
    op.drop_table("user_notifications")
