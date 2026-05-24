"""drop legacy users.sub column

Revision ID: 0009_drop_users_sub_column
Revises: 0008_add_user_password_hash
Create Date: 2026-05-23

Issue #180 follow-up. Pre-#180 the application stored an email-derived
``sub`` value on ``users`` and used it as the JWT subject claim. After #180
the JWT subject is ``str(user.id)`` (an immutable UUID) and no application
code reads the DB column; only ``CurrentUser.sub`` (a JWT-claim field) is
still in use and that holds a UUID string, not this column.

Leaving the column in place created a dual UNIQUE constraint surface
(``users_sub_key`` *and* ``users_email_key``). Upserts in
``crud.get_or_create_db_user`` use ``ON CONFLICT (email)`` which does NOT
cover the ``sub`` unique index — a parallel insert with the same email
therefore fails with ``IntegrityError`` on ``ix_users_sub`` before the
``email`` conflict handler can run. Dropping the column collapses the two
constraints into one and removes the false-positive race.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0009_drop_users_sub_column"
down_revision: str | None = "0008_add_user_password_hash"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("users_sub_idx", table_name="users")
    op.drop_constraint("users_sub_key", "users", type_="unique")
    op.drop_column("users", "sub")


def downgrade() -> None:
    # Reintroduce the column nullable=True first so existing rows can be
    # backfilled (sub <- email) before re-asserting NOT NULL + UNIQUE.
    import sqlalchemy as sa

    op.add_column("users", sa.Column("sub", sa.Text(), nullable=True))
    op.execute("UPDATE users SET sub = email WHERE sub IS NULL")
    op.alter_column("users", "sub", nullable=False)
    op.create_unique_constraint("users_sub_key", "users", ["sub"])
    op.create_index("users_sub_idx", "users", ["sub"])
