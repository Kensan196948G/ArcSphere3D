"""Unit tests for SimpleRateLimiter.

The limiter is a pure in-memory sliding-window primitive used by login
brute-force protection.  These tests pin the invariants so a future
"clever" optimisation cannot silently weaken the gate.
"""

from __future__ import annotations

import threading

import pytest

from app.ratelimit import SimpleRateLimiter


@pytest.fixture()
def fake_clock(monkeypatch: pytest.MonkeyPatch):
    """Replace time.monotonic with a manually-advanced counter."""
    state = {"now": 1000.0}

    def now() -> float:
        return state["now"]

    monkeypatch.setattr("app.ratelimit.time.monotonic", now)
    return state


def test_allows_up_to_max_calls_then_blocks(fake_clock: dict[str, float]) -> None:
    rl = SimpleRateLimiter(max_calls=3, window_seconds=60)
    assert rl.is_allowed("a") is True
    assert rl.is_allowed("a") is True
    assert rl.is_allowed("a") is True
    # 4th call within the window is denied
    assert rl.is_allowed("a") is False


def test_separate_keys_are_independent(fake_clock: dict[str, float]) -> None:
    rl = SimpleRateLimiter(max_calls=1, window_seconds=60)
    assert rl.is_allowed("alice") is True
    # Bob still has his own quota
    assert rl.is_allowed("bob") is True
    # Both are now exhausted
    assert rl.is_allowed("alice") is False
    assert rl.is_allowed("bob") is False


def test_window_expiry_releases_quota(fake_clock: dict[str, float]) -> None:
    rl = SimpleRateLimiter(max_calls=2, window_seconds=10)
    assert rl.is_allowed("k") is True
    assert rl.is_allowed("k") is True
    assert rl.is_allowed("k") is False
    # Advance past the window — old timestamps should be pruned
    fake_clock["now"] += 11
    assert rl.is_allowed("k") is True


def test_reset_specific_key_clears_only_that_key(fake_clock: dict[str, float]) -> None:
    rl = SimpleRateLimiter(max_calls=1, window_seconds=60)
    assert rl.is_allowed("a") is True
    assert rl.is_allowed("b") is True
    rl.reset("a")
    # "a" rehabilitated, "b" still capped
    assert rl.is_allowed("a") is True
    assert rl.is_allowed("b") is False


def test_reset_all_clears_every_key(fake_clock: dict[str, float]) -> None:
    rl = SimpleRateLimiter(max_calls=1, window_seconds=60)
    assert rl.is_allowed("a") is True
    assert rl.is_allowed("b") is True
    assert rl.is_allowed("a") is False
    rl.reset()
    assert rl.is_allowed("a") is True
    assert rl.is_allowed("b") is True


def test_is_thread_safe_under_contention() -> None:
    """Concurrent callers must never collectively exceed max_calls."""
    rl = SimpleRateLimiter(max_calls=50, window_seconds=60)
    allowed: list[bool] = []
    lock = threading.Lock()

    def hammer() -> None:
        for _ in range(20):
            ok = rl.is_allowed("shared")
            with lock:
                allowed.append(ok)

    threads = [threading.Thread(target=hammer) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Exactly 50 attempts must succeed; the remaining 150 must be rejected.
    assert sum(allowed) == 50
    assert len(allowed) == 200
