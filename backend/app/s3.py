"""Boto3 S3 client — one per process, initialised during lifespan."""

from __future__ import annotations

import asyncio
from typing import Any

import boto3  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from app.config import Settings
from app.logging import logger

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
    _ensure_bucket()


def _ensure_bucket() -> None:
    """Create the S3/MinIO bucket if it does not already exist.

    Connection failures (S3 unreachable) are logged as warnings and do NOT
    raise — the app starts without S3 and individual upload calls will fail
    with informative errors when needed.
    """
    try:
        _client.head_bucket(Bucket=_bucket)
        logger.info("s3_bucket_exists", bucket=_bucket)
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code in ("404", "NoSuchBucket"):
            try:
                _client.create_bucket(Bucket=_bucket)
                logger.info("s3_bucket_created", bucket=_bucket)
            except Exception as create_exc:
                logger.warning("s3_bucket_create_failed", bucket=_bucket, error=str(create_exc))
        else:
            logger.warning("s3_bucket_check_failed", bucket=_bucket, error=str(exc))
    except Exception as exc:
        # S3 unreachable (EndpointConnectionError, etc.) — log and continue.
        logger.warning("s3_unreachable", bucket=_bucket, error=str(exc))


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
