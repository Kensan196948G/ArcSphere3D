"""create multipart_uploads table — large file upload tracking

Revision ID: 0009_multipart_uploads
Revises: 0008_audit_logs
Create Date: 2026-05-21

Enables resumable / chunked file uploads for large BIM/CAD files (Issue #131).
Tracks in-progress MinIO multipart upload sessions with per-project scope.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009_multipart_uploads"
down_revision: str | None = "0008_audit_logs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "multipart_uploads",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True
        ),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("minio_upload_id", sa.Text(), nullable=False),
        sa.Column("s3_key", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(128), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("chunk_size", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="in_progress"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("multipart_uploads_project_idx", "multipart_uploads", ["project_id"])
    op.create_index("multipart_uploads_status_idx", "multipart_uploads", ["status"])


def downgrade() -> None:
    op.drop_table("multipart_uploads")
