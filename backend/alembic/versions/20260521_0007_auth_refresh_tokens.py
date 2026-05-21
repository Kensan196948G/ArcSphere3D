"""add password_hash to users + create refresh_tokens table

Revision ID: 0007_auth_refresh_tokens
Revises: 0006_backfill_owner_members
Create Date: 2026-05-21

Enables DB-backed local authentication (Issue #128).
- password_hash: bcrypt-hashed password for local auth (NULL for SSO-only users)
- refresh_tokens: opaque refresh token store with expiry and revocation support
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_auth_refresh_tokens"
down_revision: str | None = "0006_backfill_owner_members"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))

    op.create_table(
        "refresh_tokens",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_hash", name="refresh_tokens_token_hash_key"),
    )
    op.create_index("refresh_tokens_token_hash_idx", "refresh_tokens", ["token_hash"])
    op.create_index("refresh_tokens_user_id_idx", "refresh_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_column("users", "password_hash")
