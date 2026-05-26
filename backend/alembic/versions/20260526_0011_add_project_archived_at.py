"""add projects.archived_at column

Revision ID: 0011_add_project_archived_at
Revises: 0009_drop_users_sub_column
Create Date: 2026-05-26

Issue #225: soft-delete / archive support for projects.
NULL means active; a non-NULL timestamp means archived at that time.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0011_add_project_archived_at"
down_revision = "0009_drop_users_sub_column"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "archived_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=None,
        ),
    )
    op.create_index(
        "ix_projects_archived_at",
        "projects",
        ["archived_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_projects_archived_at", table_name="projects")
    op.drop_column("projects", "archived_at")
