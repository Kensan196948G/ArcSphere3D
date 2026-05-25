"""Application settings sourced from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_ENVS = {"development", "dev", "test", "testing"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development")
    app_name: str = Field(default="ArcSphere3D")
    app_version: str = Field(default="0.1.0")

    cors_origins: str = Field(default="http://localhost:5173,http://localhost")

    database_url: str = Field(
        default="postgresql+psycopg://arc:arc@localhost:5432/arcsphere3d",
    )

    jwt_private_key_pem: str = Field(default="")
    jwt_public_key_pem: str = Field(default="")
    jwt_algorithm: str = Field(default="RS256")
    jwt_access_token_ttl_minutes: int = Field(default=60)

    s3_endpoint_url: str = Field(default="http://localhost:9000")
    s3_access_key: str = Field(default="arc")
    s3_secret_key: str = Field(default="arc-secret")
    s3_bucket: str = Field(default="arcsphere3d")
    s3_region: str = Field(default="us-east-1")

    log_level: str = Field(default="INFO")

    anthropic_api_key: str = Field(default="")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production_like(self) -> bool:
        return self.app_env.lower() not in DEV_ENVS

    @model_validator(mode="after")
    def _validate_security_invariants(self) -> Settings:
        if "*" in self.cors_origin_list:
            raise ValueError(
                "cors_origins cannot contain '*' — the app sends credentials, "
                "and the Fetch spec forbids the wildcard with credentialed requests"
            )
        if self.is_production_like and not self.jwt_private_key_pem:
            raise ValueError(
                f"jwt_private_key_pem must be set when app_env={self.app_env!r}; "
                "provide RSA private key PEM via JWT_PRIVATE_KEY_PEM env var"
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
