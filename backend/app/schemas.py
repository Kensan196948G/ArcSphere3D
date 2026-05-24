"""Pydantic models shared across routers."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

# Password constraints: bcrypt rejects inputs > 72 bytes (security.py raises ValueError
# rather than silently truncating, since two distinct passwords sharing the same 72-byte
# prefix would otherwise authenticate interchangeably). Restricting to printable ASCII
# guarantees char length == byte length, so max_length=72 in the OpenAPI schema is a
# tight, honest upper bound that downstream tooling (schemathesis/Hypothesis) can honor.
NewPassword = Annotated[
    str,
    Field(min_length=8, max_length=72, pattern=r"^[\x20-\x7E]+$"),
]
ExistingPassword = Annotated[
    str,
    Field(min_length=1, max_length=72, pattern=r"^[\x20-\x7E]+$"),
]


# ---- Auth ----
class LoginRequest(BaseModel):
    email: EmailStr
    password: ExistingPassword


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class CurrentUser(BaseModel):
    sub: str
    email: str | None = None
    role: str = "viewer"


class UserCreate(BaseModel):
    email: EmailStr
    password: NewPassword
    role: str = Field(default="viewer", pattern="^(admin|editor|viewer)$")


class PasswordChangeRequest(BaseModel):
    current_password: ExistingPassword
    new_password: NewPassword


class AdminPasswordReset(BaseModel):
    new_password: NewPassword


class UserOut(BaseModel):
    id: UUID
    email: str
    role: str
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: str = Field(pattern="^(admin|editor|viewer)$")


# NUL bytes (\x00) cannot be stored in PostgreSQL text columns.
# Excluding them at the schema layer prevents psycopg.DataError at the DB layer
# and keeps schemathesis-generated examples within the valid input domain.
_NO_NUL_PATTERN = r"^[^\x00]+$"


# ---- Projects ----
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128, pattern=_NO_NUL_PATTERN)
    description: str | None = Field(default=None, max_length=500, pattern=_NO_NUL_PATTERN)


class ProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128, pattern=_NO_NUL_PATTERN)
    description: str | None = Field(default=None, max_length=500, pattern=_NO_NUL_PATTERN)


class ProjectOut(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    owner_id: UUID
    created_at: datetime


class ProjectStats(BaseModel):
    file_count: int
    alignment_count: int
    vertical_count: int
    member_count: int


# ---- Files ----
class FileMetadata(BaseModel):
    id: UUID
    project_id: UUID
    filename: str
    size_bytes: int
    content_type: str
    uploaded_at: datetime


class FilePatch(BaseModel):
    filename: str = Field(min_length=1, max_length=255)

    @field_validator("filename")
    @classmethod
    def no_nul(cls, v: str) -> str:
        if "\x00" in v:
            raise ValueError("NUL bytes not allowed")
        return v


class DownloadUrl(BaseModel):
    url: str
    expires_in: int


# ---- Multipart upload ----


class MultipartInitRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255, pattern=_NO_NUL_PATTERN)
    content_type: str = Field(min_length=1, max_length=128)
    total_size_bytes: int = Field(ge=1)
    part_count: int = Field(ge=1, le=10000)


class MultipartInitResponse(BaseModel):
    upload_id: str
    s3_key: str
    part_urls: list[str]
    expires_in: int


class MultipartPart(BaseModel):
    part_number: int = Field(ge=1, le=10000)
    etag: str


class MultipartCompleteRequest(BaseModel):
    upload_id: str
    s3_key: str
    filename: str = Field(min_length=1, max_length=255)
    total_size_bytes: int = Field(ge=1)
    content_type: str = Field(min_length=1, max_length=128)
    parts: list[MultipartPart] = Field(min_length=1)


class MultipartAbortRequest(BaseModel):
    upload_id: str
    s3_key: str


# ---- Alignments ----
class IpPointCreate(BaseModel):
    seq: int = Field(ge=0)
    x: float
    z: float
    radius: float = Field(ge=0)


class IpPointOut(BaseModel):
    id: UUID
    alignment_id: UUID
    seq: int
    x: float
    z: float
    radius: float


class AlignmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128, pattern=_NO_NUL_PATTERN)
    design_speed: int = Field(default=60, ge=20, le=120)


class AlignmentOut(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    design_speed: int
    created_at: datetime
    ip_points: list[IpPointOut] = []


# ---- Vertical Alignments ----
class VipCreate(BaseModel):
    seq: int = Field(ge=0)
    station: float = Field(ge=0)
    elevation: float
    vc_length: float = Field(default=0, ge=0)


class VipOut(BaseModel):
    id: UUID
    vertical_alignment_id: UUID
    seq: int
    station: float
    elevation: float
    vc_length: float


class VerticalAlignmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200, pattern=_NO_NUL_PATTERN)


class VerticalAlignmentOut(BaseModel):
    id: UUID
    alignment_id: UUID
    name: str
    created_at: datetime
    vips: list[VipOut] = []


# ---- Project Members (RBAC) ----
class MemberAdd(BaseModel):
    user_id: UUID
    role: str = Field(pattern="^(owner|editor|viewer)$")


class MemberOut(BaseModel):
    project_id: UUID
    user_id: UUID
    email: str
    role: str
    created_at: datetime


# ---- Audit Logs ----
class AuditLogOut(BaseModel):
    id: UUID
    user_id: UUID | None
    actor_email: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    ip_address: str | None
    detail: str | None
    created_at: datetime


# ---- Admin Stats ----
class AdminStats(BaseModel):
    total_users: int
    total_projects: int
    total_files: int
    total_audit_events: int


# ---- Health ----
class HealthOut(BaseModel):
    status: str
    version: str
    env: str
    db: str | None = None
