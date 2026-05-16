"""files: add unique constraint (project_id, sha256) for content-based dedup

Revision ID: 0002_project_sha256_unique
Revises: 0001_initial
Create Date: 2026-05-16

"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0002_project_sha256_unique"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint("files_project_sha256_key", "files", ["project_id", "sha256"])


def downgrade() -> None:
    op.drop_constraint("files_project_sha256_key", "files", type_="unique")
