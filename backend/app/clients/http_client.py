"""HTTP client manager for outgoing async requests."""

import logging

import httpx

logger = logging.getLogger(__name__)


class HTTPClientManager:
    """Manages application-wide persistent AsyncClient with connection pooling."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient | None:
        """Return the raw AsyncClient."""
        return self._client

    def initialize(self, timeout_seconds: float = 30.0) -> None:
        """Create shared httpx.AsyncClient."""
        if self._client is not None:
            return
        logger.info(f"Initializing HTTPX AsyncClient with {timeout_seconds}s timeout...")
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
        timeout = httpx.Timeout(timeout_seconds, connect=10.0)
        self._client = httpx.AsyncClient(limits=limits, timeout=timeout)

    async def close(self) -> None:
        """Close shared httpx.AsyncClient."""
        if self._client is not None:
            logger.info("Closing HTTPX AsyncClient...")
            await self._client.aclose()
            self._client = None

    def get_client(self) -> httpx.AsyncClient:
        """Return initialized client or raise error."""
        if self._client is None:
            raise RuntimeError("HTTPClientManager is not initialized.")
        return self._client


http_client_manager = HTTPClientManager()
