"""Application settings sourced from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development")
    app_name: str = Field(default="ArcSphere3D")
    app_version: str = Field(default="0.1.0")

    cors_origins: str = Field(default="http://localhost:5173")

    database_url: str = Field(
        default="postgresql+psycopg://arc:arc@localhost:5432/arcsphere3d",
    )

    jwt_secret: str = Field(default="dev-insecure-secret-change-me-please-32chars")
    jwt_algorithm: str = Field(default="HS256")
    jwt_access_token_ttl_minutes: int = Field(default=60)

    s3_endpoint_url: str = Field(default="http://localhost:9000")
    s3_access_key: str = Field(default="arc")
    s3_secret_key: str = Field(default="arc-secret")
    s3_bucket: str = Field(default="arcsphere3d")
    s3_region: str = Field(default="us-east-1")

    log_level: str = Field(default="INFO")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
