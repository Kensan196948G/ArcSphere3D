"""add vertical_alignments and vertical_alignment_vips tables

Revision ID: 0005_vertical_alignments
Revises: 0004_project_members
Create Date: 2026-05-18

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_vertical_alignments"
down_revision: str | None = "0004_project_members"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "vertical_alignments",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("alignment_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["alignment_id"], ["alignments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vertical_alignments_alignment", "vertical_alignments", ["alignment_id"])

    op.create_table(
        "vertical_alignment_vips",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("vertical_alignment_id", sa.UUID(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("station", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("elevation", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column(
            "vc_length",
            sa.Numeric(precision=12, scale=3),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["vertical_alignment_id"],
            ["vertical_alignments.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_vertical_alignment_vips_va",
        "vertical_alignment_vips",
        ["vertical_alignment_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_vertical_alignment_vips_va", "vertical_alignment_vips")
    op.drop_table("vertical_alignment_vips")
    op.drop_index("ix_vertical_alignments_alignment", "vertical_alignments")
    op.drop_table("vertical_alignments")
