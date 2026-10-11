"""Dedicated Redis cache adapter implementing AnalysisCacheProtocol with graceful degradation."""

import json
import logging
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.domain.contracts import AnalysisCacheProtocol

logger = logging.getLogger(__name__)


class RedisAnalysisCache(AnalysisCacheProtocol):
    """Production Redis cache adapter for precomputed climate hazard analyses.

    Features:
    - Dedicated async adapter isolating Redis operations from application logic.
    - Configurable TTL support.
    - Explicit degraded mode: if Redis is temporarily unreachable or unconfigured,
      operations fail open (log warnings and treat as cache miss) to preserve
      system availability and correctness without throwing 500s.
    """

    def __init__(
        self,
        redis_client: Redis | None = None,
        key_prefix: str = "climate:analysis:",
        default_ttl_seconds: int = 86400,
    ) -> None:
        self._redis = redis_client
        self._prefix = key_prefix
        self._default_ttl = default_ttl_seconds

    def _full_key(self, cache_key: str) -> str:
        return f"{self._prefix}{cache_key}"

    async def get_analysis(self, cache_key: str) -> dict[str, Any] | None:
        """Fetch cached analysis JSON dictionary.

        Returns None if key is absent or if Redis is unreachable (degraded mode).
        """
        if self._redis is None:
            logger.debug("Redis client uninitialized; skipping cache get (degraded mode).")
            return None

        key = self._full_key(cache_key)
        try:
            raw = await self._redis.get(key)
            if raw:
                logger.debug("Redis cache hit for key '%s'", cache_key)
                return json.loads(raw)
            logger.debug("Redis cache miss for key '%s'", cache_key)
            return None
        except (RedisError, TimeoutError, OSError) as exc:
            logger.warning(
                "Redis get failed for key '%s' (%s: %s). Continuing in degraded mode.",
                cache_key,
                type(exc).__name__,
                exc,
            )
            return None

    async def set_analysis(
        self,
        cache_key: str,
        data: dict[str, Any],
        ttl_seconds: int | None = None,
    ) -> None:
        """Cache analysis result with TTL expiration.

        Silently degrades if Redis is unavailable to preserve service execution.
        """
        if self._redis is None:
            logger.debug("Redis client uninitialized; skipping cache set (degraded mode).")
            return

        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        key = self._full_key(cache_key)
        try:
            payload = json.dumps(data)
            await self._redis.set(key, payload, ex=ttl)
            logger.debug("Persisted analysis to Redis cache for key '%s' (TTL=%ds)", cache_key, ttl)
        except (RedisError, TimeoutError, OSError) as exc:
            logger.warning(
                "Redis set failed for key '%s' (%s: %s). Continuing in degraded mode.",
                cache_key,
                type(exc).__name__,
                exc,
            )

    async def invalidate(self, pattern: str) -> int:
        """Invalidate keys matching wildcard pattern."""
        if self._redis is None:
            return 0

        full_pattern = f"{self._prefix}{pattern}"
        try:
            cursor = 0
            deleted = 0
            while True:
                cursor, keys = await self._redis.scan(cursor=cursor, match=full_pattern, count=100)
                if keys:
                    deleted += await self._redis.delete(*keys)
                if cursor == 0:
                    break
            logger.info("Invalidated %d cache keys matching '%s'", deleted, full_pattern)
            return deleted
        except (RedisError, TimeoutError, OSError) as exc:
            logger.warning(
                "Redis invalidate failed for pattern '%s' (%s: %s).",
                pattern,
                type(exc).__name__,
                exc,
            )
            return 0
