"""add alignments and alignment_ip_points tables (Q3 horizontal alignment)

Revision ID: 0003_alignments
Revises: 0002_project_sha256_unique
Create Date: 2026-05-17

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_alignments"
down_revision: str | None = "0002_project_sha256_unique"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "alignments",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("design_speed", sa.Integer(), nullable=False, server_default="60"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.CheckConstraint(
            "design_speed >= 20 AND design_speed <= 120",
            name="alignments_design_speed_range",
        ),
    )
    op.create_index("alignments_project_idx", "alignments", ["project_id"])

    op.create_table(
        "alignment_ip_points",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("alignment_id", sa.UUID(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("x", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("z", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("radius", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["alignment_id"], ["alignments.id"], ondelete="CASCADE"),
        sa.CheckConstraint("radius >= 0", name="ip_points_radius_non_negative"),
    )
    op.create_index("ip_points_alignment_idx", "alignment_ip_points", ["alignment_id"])
    op.create_index(
        "ip_points_alignment_seq_idx",
        "alignment_ip_points",
        ["alignment_id", "seq"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ip_points_alignment_seq_idx", table_name="alignment_ip_points")
    op.drop_index("ip_points_alignment_idx", table_name="alignment_ip_points")
    op.drop_table("alignment_ip_points")
    op.drop_index("alignments_project_idx", table_name="alignments")
    op.drop_table("alignments")
