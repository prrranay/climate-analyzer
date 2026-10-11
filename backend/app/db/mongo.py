"""MongoDB async connection manager using PyMongo Async API."""

import logging
from typing import Any

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import ConnectionFailure, PyMongoError

logger = logging.getLogger(__name__)


class MongoDBManager:
    """Manages the AsyncMongoClient lifecycle and connection pooling."""

    def __init__(self) -> None:
        self._client: AsyncMongoClient[dict[str, Any]] | None = None
        self._db_name: str | None = None

    @property
    def client(self) -> AsyncMongoClient[dict[str, Any]] | None:
        """Return the raw AsyncMongoClient instance."""
        return self._client

    @property
    def is_connected(self) -> bool:
        """Return whether client is initialized."""
        return self._client is not None

    def connect(
        self,
        uri: str,
        db_name: str,
        min_pool_size: int = 10,
        max_pool_size: int = 50,
        server_selection_timeout_ms: int = 5000,
    ) -> None:
        """Initialize the async MongoDB client pool."""
        if self._client is not None:
            logger.warning("MongoDB client is already initialized.")
            return

        logger.info("Initializing AsyncMongoClient connection pool...")
        self._db_name = db_name
        self._client = AsyncMongoClient(
            uri,
            minPoolSize=min_pool_size,
            maxPoolSize=max_pool_size,
            serverSelectionTimeoutMS=server_selection_timeout_ms,
        )

    async def close(self) -> None:
        """Close the MongoDB connection pool gracefully."""
        if self._client is not None:
            logger.info("Closing AsyncMongoClient connection pool...")
            await self._client.close()
            self._client = None
            self._db_name = None

    async def ping(self) -> bool:
        """Ping MongoDB server to verify active connectivity."""
        if self._client is None:
            return False
        try:
            # Send a ping to confirm a successful connection
            await self._client.admin.command("ping")
            return True
        except (ConnectionFailure, PyMongoError) as exc:
            logger.warning(f"MongoDB ping failed: {exc}")
            return False

    def get_database(self) -> AsyncDatabase[dict[str, Any]]:
        """Return the active AsyncDatabase instance."""
        if self._client is None or self._db_name is None:
            raise RuntimeError("MongoDB client is not connected. Call connect() first.")
        return self._client[self._db_name]


mongo_manager = MongoDBManager()
