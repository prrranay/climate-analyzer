"""Redis-backed atomic fixed-window rate limiter with secure client identity resolution."""

import logging
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, Response, status
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.api.dependencies import get_current_settings, get_redis
from app.core.config import Settings

logger = logging.getLogger(__name__)

# Atomic Lua script for fixed-window rate limiting in Redis:
# 1. Atomically INCR the window counter key.
# 2. If this is the first request in the window (count == 1), set expiration TTL.
# 3. Retrieve current TTL to provide exact Retry-After delay to throttled clients.
_RATE_LIMIT_LUA = """
local current = redis.call('INCR', KEYS[1])
if tonumber(current) == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
"""


@dataclass(frozen=True)
class RateLimitResult:
    """Outcome of rate-limiting evaluation."""

    is_allowed: bool
    current_count: int
    limit: int
    remaining: int
    retry_after: int


def extract_client_identity(request: Request, trusted_proxies: set[str] | list[str]) -> str:
    """Resolve stable client identity without blindly trusting arbitrary headers.

    If request originates directly from a client (not listed in trusted_proxies),
    the direct socket IP is used unconditionally, ignoring any client-injected
    X-Forwarded-For headers to prevent spoofing.

    If request comes through an explicitly configured trusted reverse proxy,
    the proxy chain is inspected right-to-left to find the first untrusted upstream IP.
    """
    direct_ip = request.client.host if request.client else "127.0.0.1"

    if trusted_proxies and direct_ip in trusted_proxies:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Parse right-to-left to find the first untrusted client IP
            ips = [ip.strip() for ip in forwarded_for.split(",") if ip.strip()]
            for ip in reversed(ips):
                if ip not in trusted_proxies:
                    return ip
            if ips:
                return ips[0]

    return direct_ip


class RedisRateLimiter:
    """Atomic fixed-window rate limiter backed by shared Redis store.

    Features:
    - Pure atomic execution in Redis via Lua scripting (no race conditions).
    - Degraded mode: If Redis is unavailable or uninitialized, logs a warning
      and fails open to ensure system availability without throwing 500s.
    - No in-memory shadow store to avoid split-brain across multiple worker processes.
    """

    def __init__(self, redis_client: Redis | None, key_prefix: str = "ratelimit:") -> None:
        self._redis = redis_client
        self._prefix = key_prefix

    async def check_rate_limit(
        self,
        client_id: str,
        scope: str,
        max_requests: int,
        window_seconds: int,
    ) -> RateLimitResult:
        """Evaluate whether client request is within allowed quota."""
        if self._redis is None:
            logger.debug(
                "Redis client uninitialized; rate limiter operating in fail-open degraded mode."
            )
            return RateLimitResult(
                is_allowed=True,
                current_count=1,
                limit=max_requests,
                remaining=max_requests - 1,
                retry_after=0,
            )

        now = int(time.time())
        window_bucket = now // window_seconds
        key = f"{self._prefix}{scope}:{client_id}:{window_bucket}"

        try:
            # Redis Lua script execution is atomic
            res = await self._redis.eval(_RATE_LIMIT_LUA, 1, key, window_seconds)
            current_count = int(res[0])
            ttl = int(res[1])
            retry_after = max(ttl, 1)

            is_allowed = current_count <= max_requests
            remaining = max(0, max_requests - current_count)

            return RateLimitResult(
                is_allowed=is_allowed,
                current_count=current_count,
                limit=max_requests,
                remaining=remaining,
                retry_after=retry_after,
            )
        except (RedisError, TimeoutError, OSError) as exc:
            logger.warning(
                "Redis rate limiter unavailable (%s: %s). Degrading to fail-open.",
                type(exc).__name__,
                exc,
            )
            return RateLimitResult(
                is_allowed=True,
                current_count=1,
                limit=max_requests,
                remaining=max_requests - 1,
                retry_after=0,
            )


class RateLimiterDependency:
    """FastAPI route dependency enforcing Redis-backed rate limiting."""

    def __init__(
        self,
        scope: str = "default",
        max_requests: int | None = None,
        window_seconds: int | None = None,
    ) -> None:
        self.scope = scope
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def __call__(
        self,
        request: Request,
        response: Response,
        redis_client: Redis | None = Depends(get_redis),
        settings: Settings = Depends(get_current_settings),
    ) -> None:
        """Execute rate limit validation on incoming request."""
        if not settings.rate_limit_enabled:
            return

        limit = self.max_requests or settings.rate_limit_requests_per_minute
        window = self.window_seconds or settings.rate_limit_window_seconds
        trusted_proxies = set(settings.trusted_proxies)

        client_id = extract_client_identity(request, trusted_proxies)
        limiter = RedisRateLimiter(redis_client)

        result = await limiter.check_rate_limit(
            client_id=client_id,
            scope=self.scope,
            max_requests=limit,
            window_seconds=window,
        )

        # Standard RFC-compliant rate limit response headers
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(result.remaining)
        response.headers["X-RateLimit-Reset"] = str(result.retry_after)

        if not result.is_allowed:
            logger.warning(
                "Rate limit exceeded for client '%s' on scope '%s': %d/%d (Retry-After: %ds)",
                client_id,
                self.scope,
                result.current_count,
                limit,
                result.retry_after,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Try again in {result.retry_after} seconds.",
                headers={
                    "Retry-After": str(result.retry_after),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": str(result.remaining),
                    "X-RateLimit-Reset": str(result.retry_after),
                },
            )
