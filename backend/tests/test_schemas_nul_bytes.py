"""NUL byte rejection across text-input schemas.

Regression test for CI failure on PR #60: schemathesis generated a
`name` containing `\\x00` for POST /api/projects, which propagated to
PostgreSQL and raised psycopg.DataError. We now reject NUL bytes at
the Pydantic layer via pattern=_NO_NUL_PATTERN, so the request fails
with 422 before reaching the DB.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import AlignmentCreate, ProjectCreate, VerticalAlignmentCreate


@pytest.mark.parametrize(
    "model_cls",
    [ProjectCreate, AlignmentCreate, VerticalAlignmentCreate],
)
def test_name_rejects_nul_byte(model_cls: type) -> None:
    with pytest.raises(ValidationError):
        model_cls(name="hello\x00world")


@pytest.mark.parametrize(
    "model_cls",
    [ProjectCreate, AlignmentCreate, VerticalAlignmentCreate],
)
def test_name_accepts_normal_text(model_cls: type) -> None:
    instance = model_cls(name="valid-name")
    assert instance.name == "valid-name"
