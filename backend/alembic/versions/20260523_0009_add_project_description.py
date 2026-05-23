"""add description to projects — optional project summary

Revision ID: 0009_add_project_description
Revises: 0008_add_user_password_hash
Create Date: 2026-05-23

Adds a nullable TEXT description column to the projects table.
NULL means the project has no description set.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009_add_project_description"
down_revision: str | None = "0008_add_user_password_hash"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "description")
