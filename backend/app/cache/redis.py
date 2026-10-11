"""Redis async connection manager using redis.asyncio."""

import logging

from redis.asyncio import ConnectionError as RedisConnectionError
from redis.asyncio import Redis
from redis.asyncio import TimeoutError as RedisTimeoutError

logger = logging.getLogger(__name__)


class RedisManager:
    """Manages the Redis asyncio client lifecycle and connection pool."""

    def __init__(self) -> None:
        self._redis: Redis | None = None

    @property
    def client(self) -> Redis | None:
        """Return the raw Redis client instance."""
        return self._redis

    @property
    def is_connected(self) -> bool:
        """Return whether Redis client is initialized."""
        return self._redis is not None

    def connect(
        self,
        url: str,
        socket_timeout: float = 5.0,
        socket_connect_timeout: float = 5.0,
    ) -> None:
        """Initialize the async Redis client."""
        if self._redis is not None:
            logger.warning("Redis client is already initialized.")
            return

        logger.info("Initializing Redis async client...")
        self._redis = Redis.from_url(
            url,
            socket_timeout=socket_timeout,
            socket_connect_timeout=socket_connect_timeout,
            decode_responses=True,
        )

    async def close(self) -> None:
        """Close Redis connection and pool."""
        if self._redis is not None:
            logger.info("Closing Redis connection...")
            await self._redis.aclose()
            self._redis = None

    async def ping(self) -> bool:
        """Ping Redis server to verify connectivity."""
        if self._redis is None:
            return False
        try:
            pong = await self._redis.ping()
            return bool(pong)
        except (RedisConnectionError, RedisTimeoutError, OSError) as exc:
            logger.warning(f"Redis ping failed: {exc}")
            return False

    def get_client(self) -> Redis:
        """Return the active Redis client."""
        if self._redis is None:
            raise RuntimeError("Redis client is not connected. Call connect() first.")
        return self._redis


redis_manager = RedisManager()
