"""Boto3 S3 client — one per process, initialised during lifespan."""

from __future__ import annotations

import asyncio
from typing import Any

import boto3  # type: ignore[import-untyped]
from botocore.config import Config  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from app.config import Settings
from app.logging import logger

_client: Any = None
_bucket: str = ""

# Short timeout so _ensure_bucket() fails fast in environments without S3
# (CI, tests).  Without this, boto3 waits up to ~60 s for TCP timeout.
_PROBE_CONFIG = Config(connect_timeout=3, retries={"max_attempts": 0})


def init_s3(settings: Settings) -> None:
    global _client, _bucket
    _client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=_PROBE_CONFIG,
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


# ---- Multipart upload helpers ----

_CHUNK_SIZE = 10 * 1024 * 1024  # 10 MiB — MinIO recommended minimum: 5 MiB


def _create_multipart_sync(key: str, content_type: str) -> str:
    resp = _client.create_multipart_upload(Bucket=_bucket, Key=key, ContentType=content_type)
    return resp["UploadId"]  # type: ignore[no-any-return]


async def create_multipart_upload(key: str, content_type: str) -> str:
    """Initiate a multipart upload and return the upload_id."""
    return await asyncio.to_thread(_create_multipart_sync, key, content_type)


def _presign_part_sync(key: str, upload_id: str, part_number: int, expires: int) -> str:
    return _client.generate_presigned_url(  # type: ignore[no-any-return]
        "upload_part",
        Params={
            "Bucket": _bucket,
            "Key": key,
            "UploadId": upload_id,
            "PartNumber": part_number,
        },
        ExpiresIn=expires,
    )


async def generate_presigned_part_url(
    key: str, upload_id: str, part_number: int, expires: int = 3600
) -> str:
    """Return a pre-signed PUT URL for a single part of a multipart upload."""
    return await asyncio.to_thread(_presign_part_sync, key, upload_id, part_number, expires)


def _complete_multipart_sync(key: str, upload_id: str, parts: list[dict[str, Any]]) -> None:
    _client.complete_multipart_upload(
        Bucket=_bucket,
        Key=key,
        UploadId=upload_id,
        MultipartUpload={"Parts": parts},
    )


async def complete_multipart_upload(key: str, upload_id: str, parts: list[dict[str, Any]]) -> None:
    """Complete a multipart upload. *parts* is a list of {PartNumber, ETag} dicts."""
    await asyncio.to_thread(_complete_multipart_sync, key, upload_id, parts)


def _abort_multipart_sync(key: str, upload_id: str) -> None:
    _client.abort_multipart_upload(Bucket=_bucket, Key=key, UploadId=upload_id)


async def abort_multipart_upload(key: str, upload_id: str) -> None:
    """Abort a multipart upload and clean up incomplete parts from MinIO."""
    await asyncio.to_thread(_abort_multipart_sync, key, upload_id)
