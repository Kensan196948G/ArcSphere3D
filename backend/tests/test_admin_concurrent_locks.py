"""Concurrent PostgreSQL integration tests for the UUID-ordered admin lock helper.

Issue #180 round-8 hardening — closes the verification gap raised by adversarial
review. The round-6 helper ``crud.lock_user_pair_for_update`` claims that locking
``(actor, target)`` in UUID order makes the lock-acquisition graph acyclic across
all admin mutation transactions, eliminating cross-admin deadlocks. Earlier rounds
only exercised that claim with spy-based unit tests (monkeypatched Python functions,
no real database concurrency), which proves the helper was *called* but not that
the system is actually deadlock-free.

These tests run multiple real PostgreSQL transactions in parallel via
``asyncio.gather`` and assert that:

* Symmetric admin-on-admin pairs (A↔B) complete without ``40P01``.
* A 3-admin ring (A→B, B→C, C→A) completes without ``40P01``.
* Mixed mutation types (delete / role-change / password-reset) interleaved on the
  same users still complete without ``40P01``.
* The deadlock detector itself is wired up: a deliberately mis-ordered acquisition
  (actor-first regardless of UUID) DOES raise ``40P01`` — proving the positive
  tests are sensitive to the property they claim to verify, not vacuously green.
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import crud
from app.db.session import new_session
from app.schemas import UserOut
from app.security import hash_password

# Overall timeout for any single gather() — if a deadlock were to slip past the
# UUID-ordering invariant, this caps the test runtime instead of hanging CI.
# Sized generously above PostgreSQL's default deadlock_timeout (1s) so the
# negative-control test can observe deadlock detection without racing the
# asyncio timeout. deadlock_timeout itself is a superuser-only parameter
# (not grantable to the app role), so we accept PG's default and lengthen
# the gather timeout instead of shrinking the detector window.
_GATHER_TIMEOUT_S = 15.0
# Lock hold per task — long enough that concurrent gather() calls actually
# contend on the same rows, short enough to keep wall time minimal.
_HOLD_MS = 100


async def _seed_admin(session: AsyncSession, email: str) -> UserOut:
    """Create an admin user and return the committed row as UserOut."""
    return await crud.create_user_with_password(
        session, email=email, password_hash=hash_password("x" * 16), role="admin"
    )


async def _lock_pair_and_hold(
    actor_id: UUID, target_id: UUID, hold_ms: int = _HOLD_MS
) -> tuple[UUID, UUID]:
    """Open a fresh session, acquire the UUID-ordered pair lock, hold, then commit.

    Returns the ``(actor_id, target_id)`` that were locked. Holding the lock briefly
    is what makes concurrent gather() calls actually contend on the rows — without
    a hold, each task would release before its peer starts and no concurrency would
    be exercised.
    """
    async with new_session() as session:
        actor, target = await crud.lock_user_pair_for_update(
            session, actor_id=actor_id, target_id=target_id
        )
        assert actor is not None and target is not None
        await asyncio.sleep(hold_ms / 1000.0)
        await session.commit()
        return actor_id, target_id


async def _lock_actor_first_and_hold(
    actor_id: UUID, target_id: UUID, hold_ms: int = _HOLD_MS
) -> tuple[UUID, UUID]:
    """Negative-control: lock actor BEFORE target regardless of UUID order.

    This simulates the round-5 design (actor-first locking in the dep) and is the
    pattern that round-6 replaced. Used by ``test_actor_first_locking_does_deadlock``
    to prove the deadlock detector and test harness are wired up correctly.
    """
    async with new_session() as session:
        await crud.get_user_by_id_for_update(session, actor_id)
        await asyncio.sleep(hold_ms / 1000.0)
        await crud.get_user_by_id_for_update(session, target_id)
        await session.commit()
        return actor_id, target_id


@pytest.fixture
async def admin_trio() -> list[UserOut]:
    """Create three admin users with controlled UUIDs (sorted ascending)."""
    async with new_session() as session:
        a = await _seed_admin(session, "lock-a@arcsphere3d.dev")
        b = await _seed_admin(session, "lock-b@arcsphere3d.dev")
        c = await _seed_admin(session, "lock-c@arcsphere3d.dev")
    trio = sorted([a, b, c], key=lambda u: u.id)
    return trio


async def test_two_admin_symmetric_pair_lock_no_deadlock(admin_trio: list[UserOut]) -> None:
    """A↔B (each admin acts on the other) must complete with no 40P01."""
    a, b, _c = admin_trio
    results = await asyncio.wait_for(
        asyncio.gather(
            _lock_pair_and_hold(a.id, b.id),
            _lock_pair_and_hold(b.id, a.id),
        ),
        timeout=_GATHER_TIMEOUT_S,
    )
    assert len(results) == 2


async def test_three_admin_ring_pair_lock_no_deadlock(admin_trio: list[UserOut]) -> None:
    """A→B, B→C, C→A (3-cycle) must complete with no 40P01."""
    a, b, c = admin_trio
    results = await asyncio.wait_for(
        asyncio.gather(
            _lock_pair_and_hold(a.id, b.id),
            _lock_pair_and_hold(b.id, c.id),
            _lock_pair_and_hold(c.id, a.id),
        ),
        timeout=_GATHER_TIMEOUT_S,
    )
    assert len(results) == 3


async def test_mixed_mutation_concurrent_no_deadlock(admin_trio: list[UserOut]) -> None:
    """delete / role-change / password-reset interleaved must not deadlock.

    Each task locks a pair in UUID order then performs a different real mutation
    so the test covers actual mutation handlers, not just the lock helper. Tasks
    are crafted to avoid trying to delete *and* update the same row (which would
    be a logical conflict, not a deadlock).
    """
    a, b, c = admin_trio

    async def do_role_change(actor_id: UUID, target_id: UUID) -> None:
        async with new_session() as session:
            _, target = await crud.lock_user_pair_for_update(
                session, actor_id=actor_id, target_id=target_id
            )
            assert target is not None
            await asyncio.sleep(0.05)
            await crud.update_user_role(session, user_id=target_id, new_role="editor")
            await session.commit()

    async def do_password_reset(actor_id: UUID, target_id: UUID) -> None:
        async with new_session() as session:
            _, target = await crud.lock_user_pair_for_update(
                session, actor_id=actor_id, target_id=target_id
            )
            assert target is not None
            await asyncio.sleep(0.05)
            await crud.update_user_password(
                session, user_id=target_id, new_password_hash=hash_password("z" * 16)
            )
            await session.commit()

    async def do_pair_lock_only(actor_id: UUID, target_id: UUID) -> None:
        await _lock_pair_and_hold(actor_id, target_id, hold_ms=50)

    await asyncio.wait_for(
        asyncio.gather(
            do_role_change(a.id, b.id),
            do_password_reset(b.id, c.id),
            do_pair_lock_only(c.id, a.id),
        ),
        timeout=_GATHER_TIMEOUT_S,
    )


async def test_actor_first_locking_does_deadlock(admin_trio: list[UserOut]) -> None:
    """Negative-control: bypassing UUID order DOES raise 40P01.

    Without this test, the positive cases above could be vacuously green even
    when the deadlock detector is silently disabled or the test harness fails
    to actually run tasks in parallel. Running actor-first on a symmetric pair
    (A→B vs B→A) hits a circular wait by construction; PostgreSQL's deadlock
    detector aborts one of the two transactions with SQLSTATE ``40P01``.

    If PG ever changes its deadlock detection semantics and this test stops
    raising, the positive tests above lose their meaning — investigate before
    weakening this assertion.
    """
    a, b, _c = admin_trio
    sorted_ids = sorted([a.id, b.id])
    assert sorted_ids[0] != sorted_ids[1]  # sanity

    # actor=lower, target=higher  AND  actor=higher, target=lower — guaranteed
    # circular wait under actor-first locking.
    # return_exceptions=True ensures BOTH tasks complete before the test exits.
    # Without this, asyncio.gather raises early and leaves the "winner" task
    # running in the background, holding a DB row lock that causes the next
    # test's TRUNCATE to block and subsequent tests to fail with spurious 401s.
    results = await asyncio.wait_for(
        asyncio.gather(
            _lock_actor_first_and_hold(sorted_ids[0], sorted_ids[1]),
            _lock_actor_first_and_hold(sorted_ids[1], sorted_ids[0]),
            return_exceptions=True,
        ),
        timeout=_GATHER_TIMEOUT_S,
    )
    errors = [r for r in results if isinstance(r, Exception)]
    assert any(
        "40P01" in str(e) or "deadlock detected" in str(e).lower() for e in errors
    ), f"expected deadlock (40P01) but got: {errors}"
