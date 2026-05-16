"""Boto3 S3 client — one per process, initialised during lifespan."""

from __future__ import annotations

import asyncio
from typing import Any

import boto3  # type: ignore[import-untyped]

from app.config import Settings

_client: Any = None
_bucket: str = ""


def init_s3(settings: Settings) -> None:
    global _client, _bucket
    _client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
    )
    _bucket = settings.s3_bucket


def _put_sync(key: str, body: bytes, content_type: str) -> None:
    _client.put_object(Bucket=_bucket, Key=key, Body=body, ContentType=content_type)


async def put_object(key: str, body: bytes, content_type: str) -> None:
    """Upload *body* to the configured S3 bucket at *key*."""
    await asyncio.to_thread(_put_sync, key, body, content_type)


def _delete_sync(key: str) -> None:
    _client.delete_object(Bucket=_bucket, Key=key)


async def delete_object(key: str) -> None:
    """Delete the object at *key* from the configured S3 bucket."""
    await asyncio.to_thread(_delete_sync, key)


def _presign_sync(key: str, expires: int) -> str:
    return _client.generate_presigned_url(  # type: ignore[no-any-return]
        "get_object",
        Params={"Bucket": _bucket, "Key": key},
        ExpiresIn=expires,
    )


async def generate_presigned_url(key: str, expires: int = 3600) -> str:
    """Return a pre-signed GET URL for *key* valid for *expires* seconds."""
    return await asyncio.to_thread(_presign_sync, key, expires)
