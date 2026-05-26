"""add tags and project_tags tables

Revision ID: 0012_add_tags
Revises: 0011_add_project_archived_at
Create Date: 2026-05-26

Issue #229: project tag management — tagging and tag filtering.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0012_add_tags"
down_revision = "0011_add_project_archived_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#6366f1"),
        sa.Column(
            "created_by",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_tags_name", "tags", ["name"], unique=True)

    op.create_table(
        "project_tags",
        sa.Column(
            "project_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("project_id", "tag_id", name="uq_project_tags"),
    )


def downgrade() -> None:
    op.drop_table("project_tags")
    op.drop_index("ix_tags_name", table_name="tags")
    op.drop_table("tags")
