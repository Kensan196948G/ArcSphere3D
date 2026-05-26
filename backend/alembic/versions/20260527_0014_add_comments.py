"""add comments table

Revision ID: 0014_add_comments
Revises: 0013_add_project_tags
Create Date: 2026-05-27

Issue #233: project comment / discussion thread.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0014_add_comments"
down_revision = "0013_add_project_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column(
            "project_id",
            sa.UUID(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_comments_project_id", "comments", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_comments_project_id", table_name="comments")
    op.drop_table("comments")
