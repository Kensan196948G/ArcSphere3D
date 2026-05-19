"""backfill project_members owner rows for existing projects

Revision ID: 0006_backfill_owner_members
Revises: 0005_vertical_alignments
Create Date: 2026-05-19

For each existing project that does not yet have a (project_id, owner_id)
row in project_members with role='owner', insert one.  This makes the
multi-owner model consistent: every project always has at least one owner
row in project_members, enabling the last-owner protection added in #66.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_backfill_owner_members"
down_revision: str | None = "0005_vertical_alignments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text("""
        INSERT INTO project_members (project_id, user_id, role, created_at)
        SELECT p.id, p.owner_id, 'owner', now()
        FROM   projects p
        WHERE  NOT EXISTS (
            SELECT 1
            FROM   project_members pm
            WHERE  pm.project_id = p.id
              AND  pm.user_id    = p.owner_id
              AND  pm.role       = 'owner'
        )
        """)
    )


def downgrade() -> None:
    raise RuntimeError(
        "Irreversible migration: cannot safely distinguish backfilled owner rows "
        "from rows added by application code after migration 0006."
    )
