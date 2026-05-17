"""add project_members table for RBAC

Revision ID: 0004_project_members
Revises: 0003_alignments
Create Date: 2026-05-18

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_project_members"
down_revision: str | None = "0003_alignments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_members",
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "role",
            sa.String(16),
            sa.CheckConstraint("role IN ('owner','editor','viewer')", name="ck_member_role"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id", "user_id"),
    )
    op.create_index("ix_project_members_project", "project_members", ["project_id"])
    op.create_index("ix_project_members_user", "project_members", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_project_members_user", "project_members")
    op.drop_index("ix_project_members_project", "project_members")
    op.drop_table("project_members")
