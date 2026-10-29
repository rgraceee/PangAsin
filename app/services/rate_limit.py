# WHAT: Tiny in-process sliding-window rate limiter (no extra dependency).
# WHY: Login brute force and accidental admin write loops need a cheap guard.
#      A single-process deployment is the current target; a multi-worker
#      deployment should swap this for a shared Redis-backed limiter.
import threading
import time


class RateLimiter:
    # WHAT: Hard cap on tracked keys so unique attacker-supplied emails cannot
    #       grow the in-process dictionary without bound.
    MAX_KEYS = 5000

    def __init__(self):
        self._lock = threading.Lock()
        self._hits = {}

    def hit(self, key, limit, window_seconds):
        """Record one attempt.

        Returns ``(allowed, retry_after_seconds)``. When the limit is exceeded
        the attempt is not recorded, so the window drains naturally.
        """
        limit = max(1, int(limit))
        window_seconds = max(1, int(window_seconds))
        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            if len(self._hits) > self.MAX_KEYS:
                self._hits = {
                    bucket_key: bucket
                    for bucket_key, bucket in self._hits.items()
                    if bucket and bucket[-1] > cutoff
                }
            bucket = [stamp for stamp in self._hits.get(key, []) if stamp > cutoff]
            if len(bucket) >= limit:
                retry_after = max(1, int(window_seconds - (now - bucket[0])) + 1)
                self._hits[key] = bucket
                return False, retry_after
            bucket.append(now)
            self._hits[key] = bucket
            return True, 0

    def reset(self, key=None):
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)
