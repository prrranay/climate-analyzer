"""Tests for health check and root endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.cache.redis import redis_manager
from app.db.mongo import mongo_manager


@pytest.mark.asyncio
async def test_root_endpoint(async_client: AsyncClient):
    """Test root endpoint returns application metadata."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert data["health"]["live"] == "/api/v1/health/live"
    assert data["health"]["ready"] == "/api/v1/health/ready"


@pytest.mark.asyncio
async def test_liveness_probe_independent(async_client: AsyncClient):
    """Liveness probe must succeed independently of DB/cache health."""
    response = await async_client.get("/api/v1/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert "timestamp" in data
    assert "app" in data
    assert "environment" in data


@pytest.mark.asyncio
async def test_readiness_probe_all_healthy(async_client: AsyncClient):
    """Readiness probe must return 200 when both MongoDB and Redis respond to ping."""
    with (
        patch.object(mongo_manager, "ping", new=AsyncMock(return_value=True)),
        patch.object(redis_manager, "ping", new=AsyncMock(return_value=True)),
    ):
        response = await async_client.get("/api/v1/health/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["components"]["mongodb"] == "connected"
        assert data["components"]["redis"] == "connected"


@pytest.mark.asyncio
async def test_readiness_probe_unhealthy_when_service_down(async_client: AsyncClient):
    """Readiness probe must return 503 when either MongoDB or Redis is down."""
    with (
        patch.object(mongo_manager, "ping", new=AsyncMock(return_value=False)),
        patch.object(redis_manager, "ping", new=AsyncMock(return_value=True)),
    ):
        response = await async_client.get("/api/v1/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["components"]["mongodb"] == "disconnected"
        assert data["components"]["redis"] == "connected"
