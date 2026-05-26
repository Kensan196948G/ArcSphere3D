"""add tags and project_tags tables

Revision ID: 0013_add_project_tags
Revises: 0012_add_user_notifications
Create Date: 2026-05-27

Issue #229: project tag management — tagging and tag-based filtering.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0013_add_project_tags"
down_revision = "0012_add_user_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False, server_default="#6366f1"),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_tags_name"),
    )
    op.create_index("ix_tags_name", "tags", ["name"])

    op.create_table(
        "project_tags",
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("tag_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id", "tag_id"),
    )
    op.create_index("ix_project_tags_tag_id", "project_tags", ["tag_id"])


def downgrade() -> None:
    op.drop_index("ix_project_tags_tag_id", table_name="project_tags")
    op.drop_table("project_tags")
    op.drop_index("ix_tags_name", table_name="tags")
    op.drop_table("tags")
