"""Integration tests executing against live local MongoDB and Redis instances."""

from datetime import date, timedelta

import pytest
from redis.asyncio import Redis

from app.cache.rate_limiter import RedisRateLimiter
from app.cache.service import RedisAnalysisCache
from app.db.mongo import MongoDBManager
from app.db.repositories import MongoCoverageRepository, MongoWeatherRepository
from app.domain.models import BaselineConfig, DailyWeatherObservation, GeoLocation
from app.services.weather_service import WeatherService
from tests.test_api_endpoints import MockWeatherProvider

# Test configuration for local integration
TEST_MONGO_URI = "mongodb://localhost:27017"
TEST_MONGO_DB = "climate_hazards_integration_test"
TEST_REDIS_URL = "redis://localhost:6379/15"  # DB 15 for test isolation


async def is_mongodb_available() -> bool:
    """Check whether local MongoDB instance is reachable."""
    mgr = MongoDBManager()
    mgr.connect(TEST_MONGO_URI, TEST_MONGO_DB, server_selection_timeout_ms=1000)
    try:
        ok = await mgr.ping()
        return ok
    finally:
        await mgr.close()


async def is_redis_available() -> bool:
    """Check whether local Redis instance is reachable."""
    try:
        r = Redis.from_url(TEST_REDIS_URL, socket_timeout=1.0)
        pong = await r.ping()
        await r.aclose()
        return bool(pong)
    except Exception:
        return False


@pytest.fixture
async def real_mongo_db():
    """Fixture providing clean temporary MongoDB database for integration testing."""
    if not await is_mongodb_available():
        pytest.skip("Local MongoDB instance not available on port 27017.")

    mgr = MongoDBManager()
    mgr.connect(TEST_MONGO_URI, TEST_MONGO_DB)
    db = mgr.get_database()

    # Clean collection before test
    await db["weather_observations"].drop()
    await db["baseline_thresholds"].drop()
    await db["coverage_metadata"].drop()

    yield db

    # Cleanup afterwards
    await mgr.client.drop_database(TEST_MONGO_DB)
    await mgr.close()


@pytest.fixture
async def real_redis_client():
    """Fixture providing clean temporary Redis client for integration testing."""
    if not await is_redis_available():
        pytest.skip("Local Redis instance not available on port 6379.")

    r = Redis.from_url(TEST_REDIS_URL, decode_responses=True)
    await r.flushdb()

    yield r

    await r.flushdb()
    await r.aclose()


# ---------------- MongoDB Live Integration Tests ----------------


@pytest.mark.asyncio
async def test_live_mongodb_repositories_lifecycle(real_mongo_db):
    """Verify index creation, bulk upsert, queries, thresholds, and coverage in real MongoDB."""
    weather_repo = MongoWeatherRepository(real_mongo_db)
    coverage_repo = MongoCoverageRepository(real_mongo_db)

    # 1. Ensure indexes
    await weather_repo.ensure_indexes()
    await coverage_repo.ensure_indexes()

    loc = GeoLocation(latitude=17.3850, longitude=78.4867, name="Hyderabad")

    # 2. Bulk upsert observations
    obs_batch = [
        DailyWeatherObservation(
            date=date(2000, 1, 1) + timedelta(days=i),
            temp_max=28.0 + (i % 5),
            unit="°C",
            source_model="ERA5",
        )
        for i in range(10)
    ]
    inserted = await weather_repo.upsert_observations(loc, obs_batch)
    assert inserted == 10

    # Idempotent re-upsert (upserts existing, count remains identical)
    inserted_again = await weather_repo.upsert_observations(loc, obs_batch)
    assert inserted_again == 10

    # 3. Date-range query
    loaded = await weather_repo.get_observations(loc, date(2000, 1, 3), date(2000, 1, 7))
    assert len(loaded) == 5
    assert loaded[0].date == date(2000, 1, 3)
    assert loaded[-1].date == date(2000, 1, 7)

    # 4. Cached threshold storage
    baseline = BaselineConfig(
        baseline_start_year=1991,
        baseline_end_year=2020,
        percentile_threshold=95.0,
    )
    assert await weather_repo.get_cached_threshold(loc, baseline) is None

    await weather_repo.save_cached_threshold(loc, baseline, 38.5)
    cached_thresh = await weather_repo.get_cached_threshold(loc, baseline)
    assert cached_thresh == 38.5

    # 5. Coverage repository tracking & revision
    assert await coverage_repo.get_coverage(loc, "ERA5") is None

    await coverage_repo.record_coverage(
        loc,
        start_date=date(2000, 1, 1),
        end_date=date(2000, 1, 10),
        record_count=10,
        model="ERA5",
    )
    cov = await coverage_repo.get_coverage(loc, "ERA5")
    assert cov == (date(2000, 1, 1), date(2000, 1, 10))

    rev_token = await coverage_repo.get_dataset_version(loc, "ERA5")
    assert "rev1" in rev_token

    # Expand coverage -> revision increases to rev2
    await coverage_repo.record_coverage(
        loc,
        start_date=date(2000, 1, 1),
        end_date=date(2000, 1, 20),
        record_count=20,
        model="ERA5",
    )
    rev_token2 = await coverage_repo.get_dataset_version(loc, "ERA5")
    assert "rev2" in rev_token2
    assert rev_token != rev_token2


# ---------------- Redis Live Integration Tests ----------------


@pytest.mark.asyncio
async def test_live_redis_cache_adapter(real_redis_client):
    """Verify live RedisAnalysisCache get, set with TTL, and scan invalidation."""
    cache = RedisAnalysisCache(
        redis_client=real_redis_client,
        key_prefix="test:climate:analysis:",
        default_ttl_seconds=300,
    )

    key = "sample_key_123"
    assert await cache.get_analysis(key) is None

    payload = {"status": "success", "heatwaves": [1, 2, 3]}
    await cache.set_analysis(key, payload, ttl_seconds=60)

    # Verify key exists and TTL is set in Redis
    raw_val = await real_redis_client.get(f"test:climate:analysis:{key}")
    assert raw_val is not None
    ttl = await real_redis_client.ttl(f"test:climate:analysis:{key}")
    assert 0 < ttl <= 60

    # Retrieve through cache adapter
    hit = await cache.get_analysis(key)
    assert hit == payload

    # Invalidate
    deleted = await cache.invalidate("sample*")
    assert deleted == 1
    assert await cache.get_analysis(key) is None


@pytest.mark.asyncio
async def test_live_redis_rate_limiter_lua(real_redis_client):
    """Verify live atomic Lua script execution for rate limiting on real Redis server."""
    limiter = RedisRateLimiter(redis_client=real_redis_client, key_prefix="test:ratelimit:")

    client_id = "test_user_ip"
    scope = "heatwave_analysis"
    max_requests = 2
    window_seconds = 30

    # Request 1: allowed
    res1 = await limiter.check_rate_limit(client_id, scope, max_requests, window_seconds)
    assert res1.is_allowed is True
    assert res1.current_count == 1
    assert res1.remaining == 1
    assert 0 < res1.retry_after <= window_seconds

    # Request 2: allowed
    res2 = await limiter.check_rate_limit(client_id, scope, max_requests, window_seconds)
    assert res2.is_allowed is True
    assert res2.current_count == 2
    assert res2.remaining == 0

    # Request 3: blocked (exceeded limit!)
    res3 = await limiter.check_rate_limit(client_id, scope, max_requests, window_seconds)
    assert res3.is_allowed is False
    assert res3.current_count == 3
    assert res3.remaining == 0
    assert 0 < res3.retry_after <= window_seconds


# ---------------- Historical Range Reuse Tests ----------------


@pytest.mark.asyncio
async def test_live_weather_service_stored_range_reuse(real_mongo_db):
    """Verify repeated analyses reuse stored observations and only fetch missing segments."""
    weather_repo = MongoWeatherRepository(real_mongo_db)
    coverage_repo = MongoCoverageRepository(real_mongo_db)
    await weather_repo.ensure_indexes()
    await coverage_repo.ensure_indexes()

    mock_provider = MockWeatherProvider()
    service = WeatherService(
        weather_repo=weather_repo,
        weather_provider=mock_provider,
        coverage_repo=coverage_repo,
    )

    loc = GeoLocation(latitude=17.3850, longitude=78.4867)

    # Call 1: Initial ingestion for 2000-2002 (3 years = 1096 days)
    obs1 = await service.ensure_historical_observations(
        location=loc,
        start_date=date(2000, 1, 1),
        end_date=date(2002, 12, 31),
    )
    expected_days1 = (date(2002, 12, 31) - date(2000, 1, 1)).days + 1
    assert len(obs1) == expected_days1

    # Call 2: Exact repeated analysis for 2000-2002
    # Provider must NOT be called again (observations generated list remains unchanged)
    provider_calls_before = len(mock_provider.generated_obs)
    obs2 = await service.ensure_historical_observations(
        location=loc,
        start_date=date(2000, 1, 1),
        end_date=date(2002, 12, 31),
    )
    assert len(obs2) == expected_days1
    # Zero new observations generated by provider: 100% reused from MongoDB!
    assert len(mock_provider.generated_obs) == provider_calls_before

    # Call 3: Expanded query requesting 2000-2004 (2 new years = 2003-2004)
    # Service must reuse 2000-2002 and only fetch 2003-2004 from provider
    obs3 = await service.ensure_historical_observations(
        location=loc,
        start_date=date(2000, 1, 1),
        end_date=date(2004, 12, 31),
    )
    expected_days3 = (date(2004, 12, 31) - date(2000, 1, 1)).days + 1
    assert len(obs3) == expected_days3
