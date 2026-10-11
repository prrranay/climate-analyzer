"""Integration tests for FastAPI endpoints with mock dependency injection."""

from datetime import date, timedelta
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import (
    get_analysis_cache,
    get_coverage_repository,
    get_geocoding_provider,
    get_weather_provider,
    get_weather_repository,
)
from app.clients.open_meteo.exceptions import (
    OpenMeteoRateLimitError,
    OpenMeteoUpstreamError,
)
from app.domain.contracts import (
    AnalysisCacheProtocol,
    CoverageMetadataRepositoryProtocol,
    GeocodingProviderProtocol,
    HistoricalWeatherProviderProtocol,
    WeatherRepositoryProtocol,
)
from app.domain.models import BaselineConfig, DailyWeatherObservation, GeoLocation
from app.main import create_app

# ---------------- Test Mocks ----------------


class MockGeocodingProvider(GeocodingProviderProtocol):
    """In-memory mock for GeocodingProviderProtocol."""

    def __init__(self, candidates: list[GeoLocation] | None = None) -> None:
        self.candidates = candidates or [
            GeoLocation(
                latitude=17.3850,
                longitude=78.4867,
                name="Hyderabad",
                country="India",
                country_code="IN",
                admin1="Telangana",
                elevation=542.0,
                timezone="Asia/Kolkata",
            )
        ]
        self.should_raise: Exception | None = None

    async def search_locations(self, query: str, limit: int = 5) -> list[GeoLocation]:
        if self.should_raise:
            raise self.should_raise
        clean = query.strip().lower()
        return [c for c in self.candidates if clean in (c.name or "").lower()][:limit]


class MockWeatherRepository(WeatherRepositoryProtocol):
    """In-memory mock repository for weather observations."""

    def __init__(self, preloaded_obs: list[DailyWeatherObservation] | None = None) -> None:
        self.storage: dict[tuple[date, str], DailyWeatherObservation] = {
            (obs.date, getattr(obs, "source_model", "ERA5")): obs for obs in (preloaded_obs or [])
        }
        self.cached_thresholds: dict[tuple[int, int, float, str], float] = {}

    async def upsert_observations(
        self,
        location: GeoLocation,
        observations: list[DailyWeatherObservation],
    ) -> int:
        _ = location
        for obs in observations:
            self.storage[(obs.date, getattr(obs, "source_model", "ERA5"))] = obs
        return len(observations)

    async def get_observations(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        _ = location
        return [
            obs
            for (d, m), obs in sorted(self.storage.items(), key=lambda item: item[0][0])
            if start_date <= d <= end_date and m == model
        ]

    async def get_cached_threshold(
        self,
        location: GeoLocation,
        baseline: BaselineConfig,
    ) -> float | None:
        _ = location
        key = (
            baseline.baseline_start_year,
            baseline.baseline_end_year,
            baseline.percentile_threshold,
            baseline.source_model,
        )
        return self.cached_thresholds.get(key)

    async def save_cached_threshold(
        self,
        location: GeoLocation,
        baseline: BaselineConfig,
        threshold_celsius: float,
    ) -> None:
        _ = location
        key = (
            baseline.baseline_start_year,
            baseline.baseline_end_year,
            baseline.percentile_threshold,
            baseline.source_model,
        )
        self.cached_thresholds[key] = threshold_celsius


class MockCoverageRepository(CoverageMetadataRepositoryProtocol):
    """In-memory mock for CoverageMetadataRepositoryProtocol."""

    def __init__(self) -> None:
        self.coverage: dict[str, tuple[date, date]] = {}

    async def get_coverage(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> tuple[date, date] | None:
        _ = (location, model)
        return None

    async def record_coverage(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        record_count: int,
        schema_version: str = "v1",
        model: str = "ERA5",
    ) -> None:
        _ = (location, start_date, end_date, record_count, schema_version, model)

    async def get_dataset_version(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> str:
        _ = (location, model)
        return "rev1_mock"


class MockWeatherProvider(HistoricalWeatherProviderProtocol):
    """Mock for HistoricalWeatherProviderProtocol."""

    def __init__(self) -> None:
        self.should_raise: Exception | None = None
        self.generated_obs: list[DailyWeatherObservation] = []

    async def fetch_historical_daily(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        _ = location
        if self.should_raise:
            raise self.should_raise

        batch: list[DailyWeatherObservation] = []
        curr = start_date
        while curr <= end_date:
            # Normal baseline temperature 25°C, with hot days in July 2003
            temp = 25.0
            if curr.year == 2003 and curr.month == 7 and 10 <= curr.day <= 13:
                temp = 36.0  # 4-day heatwave

            batch.append(
                DailyWeatherObservation(
                    date=curr,
                    temp_max=temp,
                    unit="°C",
                    source_model=model,
                )
            )
            curr += timedelta(days=1)

        self.generated_obs.extend(batch)
        return batch


class MockAnalysisCache(AnalysisCacheProtocol):
    """In-memory mock for AnalysisCacheProtocol."""

    def __init__(self) -> None:
        self.cache: dict[str, dict[str, Any]] = {}

    async def get_analysis(self, cache_key: str) -> dict[str, Any] | None:
        return self.cache.get(cache_key)

    async def set_analysis(
        self, cache_key: str, data: dict[str, Any], ttl_seconds: int = 3600
    ) -> None:
        _ = ttl_seconds
        self.cache[cache_key] = data

    async def invalidate(self, pattern: str) -> int:
        _ = pattern
        count = len(self.cache)
        self.cache.clear()
        return count


# ---------------- Test Fixtures ----------------


@pytest.fixture
def app_with_mocks():
    """Create test application with mocked database and upstream adapters."""
    app = create_app()

    mock_geo = MockGeocodingProvider()
    mock_repo = MockWeatherRepository()
    mock_coverage = MockCoverageRepository()
    mock_provider = MockWeatherProvider()
    mock_cache = MockAnalysisCache()

    app.dependency_overrides[get_geocoding_provider] = lambda: mock_geo
    app.dependency_overrides[get_weather_repository] = lambda: mock_repo
    app.dependency_overrides[get_coverage_repository] = lambda: mock_coverage
    app.dependency_overrides[get_weather_provider] = lambda: mock_provider
    app.dependency_overrides[get_analysis_cache] = lambda: mock_cache

    app.state.mock_geo = mock_geo
    app.state.mock_repo = mock_repo
    app.state.mock_coverage = mock_coverage
    app.state.mock_provider = mock_provider
    app.state.mock_cache = mock_cache

    return app


# ---------------- API Endpoint Tests ----------------


@pytest.mark.asyncio
async def test_api_regions_search_success(app_with_mocks):
    """Verify GET /api/v1/regions/search returns 200 with mapped locations."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_mocks), base_url="http://test"
    ) as client:
        resp = await client.get("/api/v1/regions/search?q=Hyderabad&count=5")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Hyderabad"
        assert data[0]["latitude"] == 17.3850
        assert data[0]["longitude"] == 78.4867
        assert data[0]["country"] == "India"


@pytest.mark.asyncio
async def test_api_regions_search_empty(app_with_mocks):
    """Verify GET /api/v1/regions/search returns 200 with empty list when no matches."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_mocks), base_url="http://test"
    ) as client:
        resp = await client.get("/api/v1/regions/search?q=NonExistentPlace")
        assert resp.status_code == 200
        assert resp.json() == []


@pytest.mark.asyncio
async def test_api_regions_search_validation_error(app_with_mocks):
    """Verify GET /api/v1/regions/search with too-short query returns 422 ErrorResponse."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_mocks), base_url="http://test"
    ) as client:
        resp = await client.get("/api/v1/regions/search?q=a")
        assert resp.status_code == 422
        data = resp.json()
        assert data["error_code"] == "VALIDATION_ERROR"
        assert "details" in data


@pytest.mark.asyncio
async def test_api_regions_search_upstream_failure(app_with_mocks):
    """Verify upstream geocoding failure returns 502 with ErrorResponse."""
    app_with_mocks.state.mock_geo.should_raise = OpenMeteoUpstreamError(
        "Service Unavailable", status_code=503
    )

    async with AsyncClient(
        transport=ASGITransport(app=app_with_mocks), base_url="http://test"
    ) as client:
        resp = await client.get("/api/v1/regions/search?q=Paris")
        assert resp.status_code == 502
        data = resp.json()
        assert data["error_code"] == "UPSTREAM_SERVICE_ERROR"


@pytest.mark.asyncio
async def test_api_regions_search_rate_limited(app_with_mocks):
    """Verify upstream rate limit returns 429 with ErrorResponse."""
    app_with_mocks.state.mock_geo.should_raise = OpenMeteoRateLimitError("Rate limit exceeded")

    async with AsyncClient(
        transport=ASGITransport(app=app_with_mocks), base_url="http://test"
    ) as client:
        resp = await client.get("/api/v1/regions/search?q=Paris")
        assert resp.status_code == 429
        data = resp.json()
        assert data["error_code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_api_analysis_heatwave_success(app_with_mocks):
    """Verify GET /api/v1/analysis/heatwave end-to-end with mock dependencies."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_mocks), base_url="http://test"
    ) as client:
        params = (
            "latitude=17.385&longitude=78.487"
            "&start_year=2000&end_year=2005"
            "&baseline_start_year=2000&baseline_end_year=2004"
            "&threshold_percentile=95.0&min_consecutive_days=3"
        )
        resp = await client.get(f"/api/v1/analysis/heatwave?{params}")
        assert resp.status_code == 200
        data = resp.json()

        # Schema validations
        assert "location" in data
        assert data["location"]["latitude"] == 17.385
        assert data["location"]["longitude"] == 78.487

        assert "baseline" in data
        assert data["baseline"]["baseline_start_year"] == 2000
        assert data["baseline"]["baseline_end_year"] == 2004
        # Scope 5: Calendar-day moving-window percentiles vary by day of year;
        # threshold_celsius is None
        assert data["baseline"]["threshold_celsius"] is None

        assert "data_quality" in data
        assert data["data_quality"]["completeness_percentage"] > 95.0

        assert "annual_metrics" in data
        assert len(data["annual_metrics"]) == 6  # 2000 to 2005
        # 2003 must contain the 4-day heatwave
        metric_2003 = next(m for m in data["annual_metrics"] if m["year"] == 2003)
        assert metric_2003["event_count"] == 1
        assert metric_2003["total_heatwave_days"] == 4
        assert metric_2003["max_duration_days"] == 4

        # 2004 has 0 events -> duration and intensity are None
        metric_2004 = next(m for m in data["annual_metrics"] if m["year"] == 2004)
        assert metric_2004["event_count"] == 0
        assert metric_2004["max_duration_days"] is None

        assert "trends" in data
        assert "annual_frequency" in data["trends"]

        assert "insights" in data
        assert len(data["insights"]) > 0


@pytest.mark.asyncio
async def test_api_analysis_heatwave_validation_error_inverted_years(app_with_mocks):
    """Verify inverted years returns 422 with VALIDATION_ERROR code."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_mocks), base_url="http://test"
    ) as client:
        params = "latitude=17.385&longitude=78.487&start_year=2020&end_year=2010"
        resp = await client.get(f"/api/v1/analysis/heatwave?{params}")
        assert resp.status_code == 422
        data = resp.json()
        assert data["error_code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_api_analysis_heatwave_validation_error_invalid_coordinates(app_with_mocks):
    """Verify out-of-range coordinates returns 422 with VALIDATION_ERROR code."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_mocks), base_url="http://test"
    ) as client:
        params = "latitude=99.0&longitude=78.487&start_year=2000&end_year=2010"
        resp = await client.get(f"/api/v1/analysis/heatwave?{params}")
        assert resp.status_code == 422
        data = resp.json()
        assert data["error_code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_api_analysis_heatwave_upstream_provider_failure(app_with_mocks):
    """Verify upstream weather failure returns 502 with UPSTREAM_SERVICE_ERROR."""
    app_with_mocks.state.mock_provider.should_raise = OpenMeteoUpstreamError(
        "Gateway error", status_code=502
    )

    async with AsyncClient(
        transport=ASGITransport(app=app_with_mocks), base_url="http://test"
    ) as client:
        params = "latitude=17.385&longitude=78.487&start_year=2000&end_year=2005"
        resp = await client.get(f"/api/v1/analysis/heatwave?{params}")
        assert resp.status_code == 502
        data = resp.json()
        assert data["error_code"] == "UPSTREAM_SERVICE_ERROR"
