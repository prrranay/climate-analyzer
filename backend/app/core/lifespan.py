"""Application lifespan context manager."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.cache.redis import redis_manager
from app.clients.http_client import http_client_manager
from app.core.config import Settings, get_settings
from app.db.mongo import mongo_manager
from app.db.repositories import MongoCoverageRepository, MongoWeatherRepository

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application startup and shutdown lifecycles."""
    settings: Settings = get_settings()

    logger.info(f"Starting {settings.app_name} [{settings.environment}]...")

    # Initialize external resources
    mongo_manager.connect(
        uri=settings.mongodb_uri,
        db_name=settings.mongodb_db_name,
        min_pool_size=settings.mongodb_min_pool_size,
        max_pool_size=settings.mongodb_max_pool_size,
        server_selection_timeout_ms=settings.mongodb_server_selection_timeout_ms,
    )

    redis_manager.connect(
        url=settings.redis_url,
        socket_timeout=settings.redis_socket_timeout,
        socket_connect_timeout=settings.redis_socket_connect_timeout,
    )

    http_client_manager.initialize(timeout_seconds=settings.http_timeout_seconds)

    # Verify initial connectivity (non-fatal during startup to allow resilient boot in dev/test)
    mongo_ok = await mongo_manager.ping()
    if mongo_ok:
        logger.info("MongoDB connected successfully.")
        try:
            db = mongo_manager.get_database()
            await MongoWeatherRepository(db).ensure_indexes()
            await MongoCoverageRepository(db).ensure_indexes()
            logger.info("MongoDB indexes verified and migrations completed successfully.")
        except Exception as exc:
            logger.critical("MongoDB initialization failed: %s", exc, exc_info=True)
            raise RuntimeError(f"Database index/migration failure: {exc}") from exc
    else:
        logger.warning("MongoDB ping failed on startup. Will retry on demand.")

    redis_ok = await redis_manager.ping()
    if redis_ok:
        logger.info("Redis connected successfully.")
    else:
        logger.warning("Redis ping failed on startup. Will retry on demand.")

    yield

    logger.info("Shutting down application resources...")
    await http_client_manager.close()
    await redis_manager.close()
    await mongo_manager.close()
    logger.info("Shutdown complete.")
