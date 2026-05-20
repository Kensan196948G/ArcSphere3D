"""Pydantic models shared across routers."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---- Auth ----
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class CurrentUser(BaseModel):
    sub: str
    email: str | None = None
    role: str = "viewer"


# NUL bytes (\x00) cannot be stored in PostgreSQL text columns.
# Excluding them at the schema layer prevents psycopg.DataError at the DB layer
# and keeps schemathesis-generated examples within the valid input domain.
_NO_NUL_PATTERN = r"^[^\x00]+$"


# ---- Projects ----
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128, pattern=_NO_NUL_PATTERN)


class ProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=128, pattern=_NO_NUL_PATTERN)


class ProjectOut(BaseModel):
    id: UUID
    name: str
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


# ---- Health ----
class HealthOut(BaseModel):
    status: str
    version: str
    env: str
    db: str | None = None
