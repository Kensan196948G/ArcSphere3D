"""Unit tests for the S3 wrapper.

The module is a thin shim around a process-wide boto3 client.  These tests
use `botocore.stub.Stubber` (already available transitively via boto3) to
exercise the API contract WITHOUT touching the network — there is no `moto`
in the test deps, and we want failures to be deterministic.

Special attention is paid to the fail-soft branches in `_ensure_bucket()`:
unreachable S3 in CI must NOT crash the app.
"""

from __future__ import annotations

from typing import Any

import boto3  # type: ignore[import-untyped]
import pytest
from botocore.exceptions import ClientError, EndpointConnectionError  # type: ignore[import-untyped]
from botocore.stub import Stubber  # type: ignore[import-untyped]

from app import s3 as s3mod


@pytest.fixture()
def stub_client(monkeypatch: pytest.MonkeyPatch):
    """Provide a stubbed boto3 S3 client wired into the module singleton."""
    client = boto3.client(
        "s3",
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",  # noqa: S106 — test fixture
    )
    stubber = Stubber(client)
    monkeypatch.setattr(s3mod, "_client", client)
    monkeypatch.setattr(s3mod, "_bucket", "arc-test")
    with stubber:
        yield stubber
    stubber.assert_no_pending_responses()


def test_ensure_bucket_exists_is_a_noop(stub_client: Stubber) -> None:
    """If head_bucket succeeds, no further calls are made."""
    stub_client.add_response(
        "head_bucket",
        expected_params={"Bucket": "arc-test"},
        service_response={},
    )
    s3mod._ensure_bucket()


def test_ensure_bucket_creates_when_404(stub_client: Stubber) -> None:
    """A 404 from head_bucket triggers create_bucket."""
    stub_client.add_client_error(
        "head_bucket",
        service_error_code="404",
        http_status_code=404,
        expected_params={"Bucket": "arc-test"},
    )
    stub_client.add_response(
        "create_bucket",
        expected_params={"Bucket": "arc-test"},
        service_response={},
    )
    s3mod._ensure_bucket()


def test_ensure_bucket_swallows_unreachable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """S3 unreachable (e.g. CI without MinIO) must NOT propagate."""

    class _Dead:
        def head_bucket(self, **_: Any) -> None:
            raise EndpointConnectionError(endpoint_url="http://nope:9000")

    monkeypatch.setattr(s3mod, "_client", _Dead())
    monkeypatch.setattr(s3mod, "_bucket", "arc-test")
    # Must not raise — fail-soft contract.
    s3mod._ensure_bucket()


def test_ensure_bucket_swallows_create_failure(stub_client: Stubber) -> None:
    """A failure DURING create_bucket is logged and swallowed."""
    stub_client.add_client_error(
        "head_bucket",
        service_error_code="404",
        http_status_code=404,
        expected_params={"Bucket": "arc-test"},
    )
    stub_client.add_client_error(
        "create_bucket",
        service_error_code="AccessDenied",
        http_status_code=403,
        expected_params={"Bucket": "arc-test"},
    )
    # Must not raise.
    s3mod._ensure_bucket()


def test_ensure_bucket_logs_on_non_404_client_error(stub_client: Stubber) -> None:
    """Non-404 ClientError from head_bucket is logged but not raised."""
    stub_client.add_client_error(
        "head_bucket",
        service_error_code="AccessDenied",
        http_status_code=403,
        expected_params={"Bucket": "arc-test"},
    )
    s3mod._ensure_bucket()


@pytest.mark.asyncio()
async def test_put_object_calls_boto_with_expected_params(
    stub_client: Stubber,
) -> None:
    stub_client.add_response(
        "put_object",
        expected_params={
            "Bucket": "arc-test",
            "Key": "uploads/a.bin",
            "Body": b"hello",
            "ContentType": "application/octet-stream",
        },
        service_response={},
    )
    await s3mod.put_object("uploads/a.bin", b"hello", "application/octet-stream")


@pytest.mark.asyncio()
async def test_delete_object_calls_boto_with_expected_params(
    stub_client: Stubber,
) -> None:
    stub_client.add_response(
        "delete_object",
        expected_params={"Bucket": "arc-test", "Key": "uploads/a.bin"},
        service_response={},
    )
    await s3mod.delete_object("uploads/a.bin")


@pytest.mark.asyncio()
async def test_generate_presigned_url_returns_a_url(stub_client: Stubber) -> None:
    """generate_presigned_url is computed locally by botocore — no HTTP call.

    Because of that, Stubber sees no request; we only need to assert that the
    returned URL points at our bucket+key.
    """
    url = await s3mod.generate_presigned_url("uploads/a.bin", expires=120)
    assert "arc-test" in url
    assert "uploads/a.bin" in url
    # presigned URLs always embed the signing query string
    assert "Signature=" in url or "X-Amz-Signature=" in url


@pytest.mark.asyncio()
async def test_put_object_propagates_s3_failure(stub_client: Stubber) -> None:
    """Upload errors must surface to the caller (no silent loss of data)."""
    stub_client.add_client_error(
        "put_object",
        service_error_code="InternalError",
        http_status_code=500,
        expected_params={
            "Bucket": "arc-test",
            "Key": "k",
            "Body": b"x",
            "ContentType": "text/plain",
        },
    )
    with pytest.raises(ClientError):
        await s3mod.put_object("k", b"x", "text/plain")
