"""In-memory sliding-window rate limiter (no external dependencies)."""

from __future__ import annotations

import threading
import time
from collections import defaultdict


class SimpleRateLimiter:
    """Thread-safe sliding-window rate limiter keyed by an arbitrary string (e.g. client IP).

    Uses a monotonic clock so it is immune to system-clock adjustments.
    """

    def __init__(self, max_calls: int, window_seconds: int) -> None:
        self._max_calls = max_calls
        self._window = window_seconds
        self._calls: defaultdict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def is_allowed(self, key: str) -> bool:
        """Return True and record the call if within the limit, False otherwise."""
        now = time.monotonic()
        with self._lock:
            window_start = now - self._window
            self._calls[key] = [t for t in self._calls[key] if t > window_start]
            if len(self._calls[key]) >= self._max_calls:
                return False
            self._calls[key].append(now)
            return True

    def reset(self, key: str | None = None) -> None:
        """Clear call history for *key*, or all keys when *key* is None (test helper)."""
        with self._lock:
            if key is None:
                self._calls.clear()
            else:
                self._calls.pop(key, None)
