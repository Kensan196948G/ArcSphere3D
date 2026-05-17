"""Pydantic models shared across routers."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


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


# ---- Projects ----
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class ProjectOut(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    created_at: datetime


# ---- Files ----
class FileMetadata(BaseModel):
    id: UUID
    project_id: UUID
    filename: str
    size_bytes: int
    content_type: str
    uploaded_at: datetime


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
    name: str = Field(min_length=1, max_length=128)
    design_speed: int = Field(default=60, ge=20, le=120)


class AlignmentOut(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    design_speed: int
    created_at: datetime
    ip_points: list[IpPointOut] = []


# ---- Project Members (RBAC) ----
class MemberAdd(BaseModel):
    user_id: UUID
    role: str = Field(pattern="^(owner|editor|viewer)$")


class MemberOut(BaseModel):
    project_id: UUID
    user_id: UUID
    role: str
    created_at: datetime


# ---- Health ----
class HealthOut(BaseModel):
    status: str
    version: str
    env: str
    db: str | None = None
