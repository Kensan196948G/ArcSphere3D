"""add password_hash to users — DB-backed auth

Revision ID: 0008_add_user_password_hash
Revises: 0007_add_audit_logs
Create Date: 2026-05-22

Adds a nullable password_hash column to the users table to support
DB-backed authentication alongside the existing JWT/SSO path.
NULL means the user authenticates via SSO only (no local password).

A data-seed step is intentionally omitted here; demo users are
managed in application code (_DEMO_USERS) during the MVP phase.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_add_user_password_hash"
down_revision: str | None = "0007_add_audit_logs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
