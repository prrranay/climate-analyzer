"""Unit and integration tests for Redis caching, key generation, and rate limiting."""

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient
from redis.exceptions import ConnectionError as RedisConnectionError

from app.api.dependencies import get_current_settings, get_redis
from app.cache.keys import generate_analysis_cache_key
from app.cache.rate_limiter import (
    RateLimiterDependency,
    RedisRateLimiter,
    extract_client_identity,
)
from app.cache.service import RedisAnalysisCache
from app.core.config import Settings
from app.schemas.requests import HeatwaveAnalysisQuery
from app.services.analysis_service import AnalysisService
from tests.test_api_endpoints import (
    MockAnalysisCache,
    MockCoverageRepository,
    MockWeatherProvider,
    MockWeatherRepository,
)

# ----------------- 1. Cache Key Determinism Tests -----------------


def test_cache_key_determinism_and_normalization():
    """Verify identical inputs and equivalent coordinates produce identical keys."""
    key1 = generate_analysis_cache_key(
        latitude=17.3850,
        longitude=78.4867,
        start_year=2000,
        end_year=2010,
        baseline_start_year=1991,
        baseline_end_year=2020,
        threshold_percentile=95.0,
    )
    # Coordinate precision normalization (trailing floating-point variations)
    key2 = generate_analysis_cache_key(
        latitude=17.38500001,
        longitude=78.48670001,
        start_year=2000,
        end_year=2010,
        baseline_start_year=1991,
        baseline_end_year=2020,
        threshold_percentile=95.0,
    )
    assert key1 == key2
    assert key1.startswith("analysis:17.3850_78.4867:")


def test_cache_key_differentiation_on_all_parameters():
    """Verify altering any input dimension yields a distinct cache key."""
    base_params = {
        "latitude": 17.3850,
        "longitude": 78.4867,
        "start_year": 2000,
        "end_year": 2010,
        "baseline_start_year": 1991,
        "baseline_end_year": 2020,
        "threshold_percentile": 95.0,
        "min_consecutive_days": 3,
        "threshold_method": "climatological_moving_window_15d",
        "source": "Open-Meteo",
        "model": "ERA5",
        "algorithm_version": "v1.0.0",
        "dataset_version": "rev1",
    }
    base_key = generate_analysis_cache_key(**base_params)

    # 1. Coordinates
    diff_lat = generate_analysis_cache_key(**{**base_params, "latitude": 18.0})
    assert diff_lat != base_key

    # 2. Window
    diff_window = generate_analysis_cache_key(**{**base_params, "end_year": 2011})
    assert diff_window != base_key

    # 3. Baseline period
    diff_base_start = generate_analysis_cache_key(**{**base_params, "baseline_start_year": 1990})
    assert diff_base_start != base_key

    # 4. Percentile
    diff_percentile = generate_analysis_cache_key(**{**base_params, "threshold_percentile": 90.0})
    assert diff_percentile != base_key

    # 5. Consecutive days
    diff_min_days = generate_analysis_cache_key(**{**base_params, "min_consecutive_days": 4})
    assert diff_min_days != base_key

    # 6. Model
    diff_model = generate_analysis_cache_key(**{**base_params, "model": "ERA5-LAND"})
    assert diff_model != base_key

    # 7. Algorithm version
    diff_algo = generate_analysis_cache_key(**{**base_params, "algorithm_version": "v1.1.0"})
    assert diff_algo != base_key

    # 8. Dataset revision (invalidation)
    diff_rev = generate_analysis_cache_key(**{**base_params, "dataset_version": "rev2"})
    assert diff_rev != base_key


# ----------------- 2. Redis Cache Adapter Tests -----------------


@pytest.mark.asyncio
async def test_redis_cache_adapter_lifecycle():
    """Verify get, set with TTL, and pattern invalidation in RedisAnalysisCache."""
    fake_storage: dict[str, str] = {}

    mock_redis = AsyncMock()

    async def fake_get(k: str) -> str | None:
        return fake_storage.get(k)

    async def fake_set(k: str, v: str, ex: int | None = None) -> None:
        _ = ex
        fake_storage[k] = v

    async def fake_scan(
        cursor: int = 0, match: str = "*", count: int = 10
    ) -> tuple[int, list[str]]:
        _ = (cursor, count)
        matched = [k for k in fake_storage if k.startswith(match.replace("*", ""))]
        return 0, matched

    async def fake_delete(*keys: str) -> int:
        deleted = 0
        for k in keys:
            if k in fake_storage:
                del fake_storage[k]
                deleted += 1
        return deleted

    mock_redis.get.side_effect = fake_get
    mock_redis.set.side_effect = fake_set
    mock_redis.scan.side_effect = fake_scan
    mock_redis.delete.side_effect = fake_delete

    cache = RedisAnalysisCache(redis_client=mock_redis, default_ttl_seconds=3600)

    # Cache miss
    assert await cache.get_analysis("sample_key") is None

    # Cache set
    test_data = {"test": 123, "metric": "heatwaves"}
    await cache.set_analysis("sample_key", test_data, ttl_seconds=1800)
    mock_redis.set.assert_called_with(
        "climate:analysis:sample_key",
        '{"test": 123, "metric": "heatwaves"}',
        ex=1800,
    )

    # Cache hit
    hit = await cache.get_analysis("sample_key")
    assert hit == test_data

    # Invalidate
    deleted = await cache.invalidate("sample*")
    assert deleted == 1
    assert await cache.get_analysis("sample_key") is None


@pytest.mark.asyncio
async def test_redis_cache_degraded_mode_on_failure():
    """Verify cache operations fail open without throwing errors when Redis fails."""
    failing_redis = AsyncMock()
    failing_redis.get.side_effect = RedisConnectionError("Connection refused")
    failing_redis.set.side_effect = RedisConnectionError("Connection refused")
    failing_redis.scan.side_effect = RedisConnectionError("Connection refused")

    cache = RedisAnalysisCache(redis_client=failing_redis)

    # Does not throw, returns None (degraded mode)
    assert await cache.get_analysis("key1") is None

    # Does not throw, degrades silently
    await cache.set_analysis("key1", {"data": 1})

    # Invalidate returns 0
    assert await cache.invalidate("*") == 0


@pytest.mark.asyncio
async def test_redis_cache_uninitialized_client():
    """Verify cache works cleanly when redis_client is None."""
    cache = RedisAnalysisCache(redis_client=None)
    assert await cache.get_analysis("key1") is None
    await cache.set_analysis("key1", {"data": 1})
    assert await cache.invalidate("*") == 0


# ----------------- 3. Invalidation & Dataset Version Tests -----------------


@pytest.mark.asyncio
async def test_dataset_version_invalidation_workflow():
    """Verify that updating the dataset revision automatically bypasses stale cache."""
    from app.services.weather_service import WeatherService

    mock_repo = MockWeatherRepository()
    mock_provider = MockWeatherProvider()
    mock_coverage = MockCoverageRepository()
    mock_cache = MockAnalysisCache()

    weather_service = WeatherService(
        weather_repo=mock_repo,
        weather_provider=mock_provider,
        coverage_repo=mock_coverage,
    )
    analysis_service = AnalysisService(
        weather_service=weather_service,
        cache=mock_cache,
    )

    query = HeatwaveAnalysisQuery(
        latitude=17.385,
        longitude=78.487,
        start_year=2000,
        end_year=2005,
        baseline_start_year=2000,
        baseline_end_year=2004,
    )

    # Initial execution populates cache with rev1_mock
    res1 = await analysis_service.analyze_heatwaves(query)
    assert len(mock_cache.cache) == 1
    old_cache_key = next(iter(mock_cache.cache.keys()))

    # Ingest new data causing coverage revision bump
    mock_coverage.get_dataset_version = AsyncMock(return_value="rev2_updated")

    # Second execution must compute a new cache key (invalidating old result)
    res2 = await analysis_service.analyze_heatwaves(query)
    assert len(mock_cache.cache) == 2
    new_cache_key = [k for k in mock_cache.cache if k != old_cache_key][0]
    assert old_cache_key != new_cache_key
    assert res1.location.latitude == res2.location.latitude


# ----------------- 4. Client Identity Resolution Tests -----------------


def test_client_identity_rejects_untrusted_forwarded_for():
    """Verify arbitrary X-Forwarded-For is ignored when proxy is not trusted."""

    class FakeClient:
        host = "198.51.100.42"

    request = Request(
        scope={
            "type": "http",
            "client": (FakeClient.host, 12345),
            "headers": [
                (b"x-forwarded-for", b"203.0.113.195, 10.0.0.1"),
            ],
        }
    )

    trusted_proxies = {"10.0.0.1", "127.0.0.1"}

    # Direct client is 198.51.100.42 (not in trusted_proxies) -> ignores header
    client_id = extract_client_identity(request, trusted_proxies)
    assert client_id == "198.51.100.42"


def test_client_identity_accepts_trusted_proxy_forwarded_for():
    """Verify X-Forwarded-For is resolved when request is from trusted proxy."""

    class FakeClient:
        host = "10.0.0.1"  # Trusted reverse proxy

    request = Request(
        scope={
            "type": "http",
            "client": (FakeClient.host, 12345),
            "headers": [
                (b"x-forwarded-for", b"203.0.113.195, 10.0.0.1"),
            ],
        }
    )

    trusted_proxies = {"10.0.0.1"}

    # Resolves to real client IP (first untrusted from right)
    client_id = extract_client_identity(request, trusted_proxies)
    assert client_id == "203.0.113.195"


# ----------------- 5. Atomic Redis Rate Limiter Tests -----------------


@pytest.mark.asyncio
async def test_redis_rate_limiter_allowed_and_exhausted():
    """Verify atomic Lua execution, remaining counter, and 429 when quota exceeded."""
    mock_redis = AsyncMock()

    # Call 1: current=1, ttl=60
    mock_redis.eval.return_value = [1, 60]
    limiter = RedisRateLimiter(redis_client=mock_redis)

    res1 = await limiter.check_rate_limit(
        client_id="user1",
        scope="api",
        max_requests=2,
        window_seconds=60,
    )
    assert res1.is_allowed is True
    assert res1.current_count == 1
    assert res1.remaining == 1
    assert res1.retry_after == 60

    # Call 2: current=2, ttl=55
    mock_redis.eval.return_value = [2, 55]
    res2 = await limiter.check_rate_limit(
        client_id="user1",
        scope="api",
        max_requests=2,
        window_seconds=60,
    )
    assert res2.is_allowed is True
    assert res2.remaining == 0

    # Call 3: current=3, ttl=50 -> Quota exceeded!
    mock_redis.eval.return_value = [3, 50]
    res3 = await limiter.check_rate_limit(
        client_id="user1",
        scope="api",
        max_requests=2,
        window_seconds=60,
    )
    assert res3.is_allowed is False
    assert res3.remaining == 0
    assert res3.retry_after == 50


@pytest.mark.asyncio
async def test_redis_rate_limiter_degrades_when_redis_unavailable():
    """Verify rate limiter fails open with warning when Redis raises exceptions."""
    failing_redis = AsyncMock()
    failing_redis.eval.side_effect = RedisConnectionError("Redis connection lost")

    limiter = RedisRateLimiter(redis_client=failing_redis)

    result = await limiter.check_rate_limit(
        client_id="user1",
        scope="api",
        max_requests=10,
        window_seconds=60,
    )
    # Fails open to prevent breaking service availability during transient Redis outage
    assert result.is_allowed is True
    assert result.retry_after == 0


@pytest.mark.asyncio
async def test_rate_limiter_dependency_headers_and_429():
    """Verify FastAPI dependency sets rate limit headers and raises 429 with Retry-After."""
    mock_redis = AsyncMock()
    mock_redis.eval.return_value = [5, 45]  # limit is 3 -> 429!

    app = FastAPI()
    app.dependency_overrides[get_redis] = lambda: mock_redis
    app.dependency_overrides[get_current_settings] = lambda: Settings(
        rate_limit_enabled=True,
        rate_limit_requests_per_minute=3,
        rate_limit_window_seconds=60,
    )

    limiter_dep = RateLimiterDependency(scope="test_endpoint", max_requests=3, window_seconds=60)

    @app.get("/test")
    async def sample_endpoint(_: None = pytest.importorskip("fastapi").Depends(limiter_dep)):
        return {"ok": True}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/test")
        assert resp.status_code == 429
        assert resp.headers.get("Retry-After") == "45"
        assert resp.headers.get("X-RateLimit-Limit") == "3"
        assert resp.headers.get("X-RateLimit-Remaining") == "0"
        assert resp.headers.get("X-RateLimit-Reset") == "45"
