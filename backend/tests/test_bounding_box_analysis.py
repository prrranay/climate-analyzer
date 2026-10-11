"""Unit and integration tests for geographic bounding-box heatwave analysis."""

from datetime import date
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.api.dependencies import (
    get_analysis_cache,
    get_coverage_repository,
    get_weather_provider,
    get_weather_repository,
)
from app.cache.keys import generate_analysis_cache_key, generate_bbox_cache_key
from app.domain.contracts import (
    AnalysisCacheProtocol,
    CoverageMetadataRepositoryProtocol,
    HistoricalWeatherProviderProtocol,
    WeatherRepositoryProtocol,
)
from app.domain.grid import generate_bounding_box_grid
from app.domain.models import BaselineConfig, BoundingBox, DailyWeatherObservation, GeoLocation
from app.domain.spatial_aggregation import aggregate_grid_daily_series
from app.main import create_app
from app.schemas.requests import BoundingBoxAnalysisQuery
from app.schemas.responses import BoundingBoxHeatwaveAnalysisResponse, HeatwaveAnalysisResponse

# ----------------- Mock Infrastructure -----------------


class MockBboxWeatherRepository(WeatherRepositoryProtocol):
    """In-memory repository isolating observations per canonical coordinate key."""

    def __init__(self) -> None:
        self.storage: dict[tuple[str, date], DailyWeatherObservation] = {}
        self.cached_thresholds: dict[tuple[str, int, int, float, str], float] = {}

    async def upsert_observations(
        self,
        location: GeoLocation,
        observations: list[DailyWeatherObservation],
    ) -> int:
        for obs in observations:
            model = getattr(obs, "source_model", "ERA5")
            self.storage[(location.coordinate_key, obs.date, model)] = obs
        return len(observations)

    async def get_observations(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        res: list[DailyWeatherObservation] = []
        for (coord, d, m), obs in sorted(self.storage.items(), key=lambda item: item[0][1]):
            if coord == location.coordinate_key and start_date <= d <= end_date and m == model:
                res.append(obs)
        return res

    async def get_cached_threshold(
        self,
        location: GeoLocation,
        baseline: BaselineConfig,
    ) -> float | None:
        key = (
            location.coordinate_key,
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
        key = (
            location.coordinate_key,
            baseline.baseline_start_year,
            baseline.baseline_end_year,
            baseline.percentile_threshold,
            baseline.source_model,
        )
        self.cached_thresholds[key] = threshold_celsius


class MockBboxCoverageRepository(CoverageMetadataRepositoryProtocol):
    """In-memory mock for coverage and dataset versioning."""

    def __init__(self) -> None:
        self.coverage: dict[tuple[str, str], tuple[date, date]] = {}
        self.versions: dict[str, str] = {}

    async def get_coverage(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> tuple[date, date] | None:
        return self.coverage.get((location.coordinate_key, model))

    async def record_coverage(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        record_count: int,
        schema_version: str = "v1",
        model: str = "ERA5",
    ) -> None:
        _ = (schema_version, model)
        self.coverage[(location.coordinate_key, model)] = (start_date, end_date)
        self.versions[location.coordinate_key] = f"rev_{record_count}"

    async def get_dataset_version(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> str:
        _ = model
        return self.versions.get(location.coordinate_key, "rev1_mock")


class MockBboxWeatherProvider(HistoricalWeatherProviderProtocol):
    """Mock weather provider returning synthetic daily series with hot streaks."""

    def __init__(self) -> None:
        self.fetch_calls: list[str] = []

    async def fetch_historical_daily(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        self.fetch_calls.append(location.coordinate_key)
        batch: list[DailyWeatherObservation] = []
        curr = start_date
        while curr <= end_date:
            temp = 25.0
            # Induce a heatwave in July 2003 for testing streak detection
            if curr.year == 2003 and curr.month == 7 and 10 <= curr.day <= 16:
                # Add slight spatial variance based on latitude
                temp = 38.0 + (location.latitude - 17.0) * 0.5
            batch.append(
                DailyWeatherObservation(
                    date=curr,
                    temp_max=round(temp, 2),
                    unit="°C",
                    source_model=model,
                )
            )
            curr = date.fromordinal(curr.toordinal() + 1)
        return batch


class MockBboxAnalysisCache(AnalysisCacheProtocol):
    """In-memory cache for testing hit/miss behavior."""

    def __init__(self) -> None:
        self.store: dict[str, dict[str, Any]] = {}
        self.hit_count = 0
        self.miss_count = 0

    async def get_analysis(self, cache_key: str) -> dict[str, Any] | None:
        if cache_key in self.store:
            self.hit_count += 1
            return self.store[cache_key]
        self.miss_count += 1
        return None

    async def set_analysis(
        self, cache_key: str, data: dict[str, Any], ttl_seconds: int = 86400
    ) -> None:
        _ = ttl_seconds
        self.store[cache_key] = data

    async def invalidate(self, pattern: str) -> int:
        matched = [k for k in self.store if pattern.replace("*", "") in k]
        for k in matched:
            del self.store[k]
        return len(matched)


# =========================================================================
# 1. Domain Grid Sampling Tests
# =========================================================================


def test_grid_sampling_regular_square() -> None:
    """Test regular grid generation for a 1x1 deg box with max_points=9."""
    box = BoundingBox(
        min_latitude=17.0,
        max_latitude=18.0,
        min_longitude=78.0,
        max_longitude=79.0,
    )
    points = generate_bounding_box_grid(box, max_points=9)
    assert len(points) <= 9
    assert len(points) >= 4  # Should generate a regular multi-point grid
    # Every point must be bounded inside the box
    for p in points:
        assert 17.0 <= p.latitude <= 18.0
        assert 78.0 <= p.longitude <= 79.0
    # Deterministic sorting
    lats = [p.latitude for p in points]
    assert lats == sorted(lats)


def test_grid_sampling_aspect_ratio_wide() -> None:
    """Test that a wide bounding box allocates more points along longitude."""
    box = BoundingBox(
        min_latitude=17.0,
        max_latitude=17.5,  # 0.5 deg lat
        min_longitude=70.0,
        max_longitude=74.0,  # 4.0 deg lon (aspect ratio 8:1)
    )
    points = generate_bounding_box_grid(box, max_points=8)
    assert len(points) <= 8
    unique_lats = {p.latitude for p in points}
    unique_lons = {p.longitude for p in points}
    # Longitude should have more sample divisions than latitude
    assert len(unique_lons) >= len(unique_lats)


def test_grid_sampling_tiny_box_collapses_to_centroid() -> None:
    """Tiny bounding box (< 0.05 deg) should collapse to single centroid."""
    box = BoundingBox(
        min_latitude=17.3800,
        max_latitude=17.3820,
        min_longitude=78.4800,
        max_longitude=78.4820,
    )
    points = generate_bounding_box_grid(box, max_points=9)
    assert len(points) == 1
    assert points[0].latitude == 17.3810
    assert points[0].longitude == 78.4810


def test_grid_sampling_invalid_max_points() -> None:
    """max_points < 1 must raise ValueError."""
    box = BoundingBox(
        min_latitude=10.0,
        max_latitude=12.0,
        min_longitude=20.0,
        max_longitude=22.0,
    )
    with pytest.raises(ValueError, match="max_points must be at least 1"):
        generate_bounding_box_grid(box, max_points=0)


# =========================================================================
# 2. Spatial Aggregation Tests
# =========================================================================


def test_spatial_aggregation_valid_means() -> None:
    """Test spatial mean derivation across 4 grid points over 3 calendar days."""
    d1 = date(2000, 1, 1)
    d2 = date(2000, 1, 2)
    d3 = date(2000, 1, 3)

    grid_obs = {
        "pt1": [
            DailyWeatherObservation(date=d1, temp_max=20.0),
            DailyWeatherObservation(date=d2, temp_max=22.0),
            DailyWeatherObservation(date=d3, temp_max=24.0),
        ],
        "pt2": [
            DailyWeatherObservation(date=d1, temp_max=22.0),
            DailyWeatherObservation(date=d2, temp_max=24.0),
            DailyWeatherObservation(date=d3, temp_max=26.0),
        ],
        "pt3": [
            DailyWeatherObservation(date=d1, temp_max=24.0),
            DailyWeatherObservation(date=d2, temp_max=26.0),
            DailyWeatherObservation(date=d3, temp_max=28.0),
        ],
        "pt4": [
            DailyWeatherObservation(date=d1, temp_max=26.0),
            DailyWeatherObservation(date=d2, temp_max=28.0),
            DailyWeatherObservation(date=d3, temp_max=30.0),
        ],
    }

    composite, completeness = aggregate_grid_daily_series(grid_obs, min_coverage_ratio=0.60)
    assert len(composite) == 3
    assert completeness == 100.0
    # Day 1 mean: (20 + 22 + 24 + 26) / 4 = 23.0
    assert composite[0].temp_max == 23.0
    # Day 2 mean: (22 + 24 + 26 + 28) / 4 = 25.0
    assert composite[1].temp_max == 25.0
    # Day 3 mean: (24 + 26 + 28 + 30) / 4 = 27.0
    assert composite[2].temp_max == 27.0


def test_spatial_aggregation_missing_cutoff() -> None:
    """Test that day with < 60% spatial coverage is marked as missing (None)."""
    d1 = date(2000, 1, 1)
    # 4 points: pt1 and pt2 have data (50% coverage < 60% cutoff), pt3 and pt4 have None
    grid_obs = {
        "pt1": [DailyWeatherObservation(date=d1, temp_max=30.0)],
        "pt2": [DailyWeatherObservation(date=d1, temp_max=32.0)],
        "pt3": [DailyWeatherObservation(date=d1, temp_max=None)],
        "pt4": [DailyWeatherObservation(date=d1, temp_max=None)],
    }

    composite, completeness = aggregate_grid_daily_series(grid_obs, min_coverage_ratio=0.60)
    assert len(composite) == 1
    # Coverage is 50%, below 60% threshold -> marked None
    assert composite[0].temp_max is None
    assert completeness == 50.0


def test_spatial_aggregation_partial_coverage_above_cutoff() -> None:
    """Test that day with 75% coverage (3 of 4 points valid) computes valid mean."""
    d1 = date(2000, 1, 1)
    grid_obs = {
        "pt1": [DailyWeatherObservation(date=d1, temp_max=30.0)],
        "pt2": [DailyWeatherObservation(date=d1, temp_max=32.0)],
        "pt3": [DailyWeatherObservation(date=d1, temp_max=34.0)],
        "pt4": [DailyWeatherObservation(date=d1, temp_max=None)],
    }

    composite, completeness = aggregate_grid_daily_series(grid_obs, min_coverage_ratio=0.60)
    assert len(composite) == 1
    # Mean of 30, 32, 34 = 32.0
    assert composite[0].temp_max == 32.0
    assert completeness == 75.0


# =========================================================================
# 3. Request Validation Tests
# =========================================================================


def test_bounding_box_query_valid() -> None:
    """Valid bounding box query parameters."""
    query = BoundingBoxAnalysisQuery(
        min_lat=17.0,
        max_lat=18.0,
        min_lon=78.0,
        max_lon=79.0,
        start_year=2000,
        end_year=2005,
    )
    assert query.min_latitude == 17.0
    assert query.max_latitude == 18.0
    assert query.min_longitude == 78.0
    assert query.max_longitude == 79.0


def test_bounding_box_query_inverted_latitudes() -> None:
    """Reject min_lat >= max_lat."""
    with pytest.raises(ValidationError, match="min_lat .* must be strictly less than max_lat"):
        BoundingBoxAnalysisQuery(
            min_lat=18.0,
            max_lat=17.0,
            min_lon=78.0,
            max_lon=79.0,
            start_year=2000,
            end_year=2005,
        )


def test_bounding_box_query_inverted_longitudes() -> None:
    """Reject min_lon >= max_lon."""
    with pytest.raises(ValidationError, match="min_lon .* must be strictly less than max_lon"):
        BoundingBoxAnalysisQuery(
            min_lat=17.0,
            max_lat=18.0,
            min_lon=80.0,
            max_lon=79.0,
            start_year=2000,
            end_year=2005,
        )


def test_bounding_box_query_area_exceeds_limit() -> None:
    """Reject bounding box with area > 25.0 deg^2."""
    with pytest.raises(ValidationError, match="Bounding box area .* exceeds maximum allowed limit"):
        BoundingBoxAnalysisQuery(
            min_lat=10.0,
            max_lat=16.0,  # 6 deg
            min_lon=70.0,
            max_lon=75.0,  # 5 deg -> area = 30.0 deg^2 > 25.0
            start_year=2000,
            end_year=2005,
        )


def test_bounding_box_query_invalid_years() -> None:
    """Reject start_year > end_year."""
    with pytest.raises(ValidationError, match="start_year .* cannot be greater than end_year"):
        BoundingBoxAnalysisQuery(
            min_lat=17.0,
            max_lat=18.0,
            min_lon=78.0,
            max_lon=79.0,
            start_year=2010,
            end_year=2005,
        )


# =========================================================================
# 4. Cache Key Determinism Tests
# =========================================================================


def test_bbox_cache_key_determinism() -> None:
    """Test deterministic generation and version sensitivity of bbox cache key."""
    key1 = generate_bbox_cache_key(
        min_latitude=17.0,
        max_latitude=18.0,
        min_longitude=78.0,
        max_longitude=79.0,
        grid_point_keys=["17.0000,78.0000", "18.0000,79.0000"],
        start_year=1991,
        end_year=2020,
        baseline_start_year=1991,
        baseline_end_year=2020,
        threshold_percentile=95.0,
        composite_dataset_version="comp_v1",
    )
    key2 = generate_bbox_cache_key(
        min_latitude=17.0,
        max_latitude=18.0,
        min_longitude=78.0,
        max_longitude=79.0,
        grid_point_keys=["18.0000,79.0000", "17.0000,78.0000"],  # order inverted
        start_year=1991,
        end_year=2020,
        baseline_start_year=1991,
        baseline_end_year=2020,
        threshold_percentile=95.0,
        composite_dataset_version="comp_v1",
    )
    # Order of points in input should not alter key (canonical sorted keys)
    assert key1 == key2
    assert key1.startswith("analysis:bbox:17.0000_18.0000_78.0000_79.0000:")

    # Changing dataset version invalidates key
    key3 = generate_bbox_cache_key(
        min_latitude=17.0,
        max_latitude=18.0,
        min_longitude=78.0,
        max_longitude=79.0,
        grid_point_keys=["17.0000,78.0000", "18.0000,79.0000"],
        start_year=1991,
        end_year=2020,
        baseline_start_year=1991,
        baseline_end_year=2020,
        threshold_percentile=95.0,
        composite_dataset_version="comp_v2",
    )
    assert key1 != key3

    # Point-based key must be distinctly structured
    pt_key = generate_analysis_cache_key(
        latitude=17.5,
        longitude=78.5,
        start_year=1991,
        end_year=2020,
        baseline_start_year=1991,
        baseline_end_year=2020,
        threshold_percentile=95.0,
    )
    assert pt_key.startswith("analysis:17.5000_78.5000:")
    assert "bbox" not in pt_key


# =========================================================================
# 5. Full API Endpoint Integration Tests
# =========================================================================


@pytest.fixture
def bbox_test_app() -> tuple[Any, MockBboxWeatherProvider, MockBboxAnalysisCache]:
    """App configured with bbox-isolated mocks."""
    app = create_app()
    weather_repo = MockBboxWeatherRepository()
    coverage_repo = MockBboxCoverageRepository()
    weather_provider = MockBboxWeatherProvider()
    cache = MockBboxAnalysisCache()

    app.dependency_overrides[get_weather_repository] = lambda: weather_repo
    app.dependency_overrides[get_coverage_repository] = lambda: coverage_repo
    app.dependency_overrides[get_weather_provider] = lambda: weather_provider
    app.dependency_overrides[get_analysis_cache] = lambda: cache

    return app, weather_provider, cache


@pytest.mark.asyncio
async def test_get_bounding_box_heatwave_analysis_success(
    bbox_test_app: tuple[Any, MockBboxWeatherProvider, MockBboxAnalysisCache],
) -> None:
    """Test successful 200 response from GET /api/v1/analysis/heatwave/bbox."""
    app, weather_provider, cache = bbox_test_app
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/analysis/heatwave/bbox",
            params={
                "min_lat": 17.0,
                "max_lat": 17.8,
                "min_lon": 78.0,
                "max_lon": 78.8,
                "start_year": 2000,
                "end_year": 2005,
                "baseline_start_year": 1991,
                "baseline_end_year": 2020,
                "threshold_percentile": 95.0,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Validate against response DTO schema
        validated = BoundingBoxHeatwaveAnalysisResponse.model_validate(data)
        assert validated.bounding_box.min_latitude == 17.0
        assert validated.bounding_box.max_latitude == 17.8
        assert validated.bounding_box.min_longitude == 78.0
        assert validated.bounding_box.max_longitude == 78.8
        assert validated.bounding_box.area_square_degrees == 0.64

        assert validated.spatial_sampling.grid_points_count <= 9
        coords = validated.spatial_sampling.sample_coordinates
        assert len(coords) == validated.spatial_sampling.grid_points_count
        assert validated.spatial_sampling.spatial_aggregation_method == "daily_spatial_mean"
        assert "Regional composite metric" in validated.spatial_sampling.disclaimer

        # Check annual metrics computed on the composite series
        assert len(validated.annual_metrics) == 6  # 2000 to 2005
        assert "annual_frequency" in validated.trends
        assert "heatwave_days" in validated.trends

        # Check cache interaction: second identical query hits cache
        cached_res = await client.get(
            "/api/v1/analysis/heatwave/bbox",
            params={
                "min_lat": 17.0,
                "max_lat": 17.8,
                "min_lon": 78.0,
                "max_lon": 78.8,
                "start_year": 2000,
                "end_year": 2005,
                "baseline_start_year": 1991,
                "baseline_end_year": 2020,
                "threshold_percentile": 95.0,
            },
        )
        assert cached_res.status_code == 200
        assert cache.hit_count == 1


@pytest.mark.asyncio
async def test_bounding_box_validation_error_responses(
    bbox_test_app: tuple[Any, MockBboxWeatherProvider, MockBboxAnalysisCache],
) -> None:
    """Test 422 HTTP responses for geometric and parameter violations."""
    app, _, _ = bbox_test_app
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Inverted latitudes
        res_lat = await client.get(
            "/api/v1/analysis/heatwave/bbox",
            params={
                "min_lat": 20.0,
                "max_lat": 10.0,
                "min_lon": 70.0,
                "max_lon": 75.0,
                "start_year": 2000,
                "end_year": 2005,
            },
        )
        assert res_lat.status_code == 422

        # 2. Area > 25.0 deg^2
        res_area = await client.get(
            "/api/v1/analysis/heatwave/bbox",
            params={
                "min_lat": 10.0,
                "max_lat": 16.0,
                "min_lon": 70.0,
                "max_lon": 75.0,
                "start_year": 2000,
                "end_year": 2005,
            },
        )
        assert res_area.status_code == 422


@pytest.mark.asyncio
async def test_point_analysis_backward_compatibility(
    bbox_test_app: tuple[Any, MockBboxWeatherProvider, MockBboxAnalysisCache],
) -> None:
    """Verify that existing point-based GET /heatwave endpoint works without regression."""
    app, _, _ = bbox_test_app
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/analysis/heatwave",
            params={
                "latitude": 17.385,
                "longitude": 78.487,
                "start_year": 2000,
                "end_year": 2005,
                "baseline_start_year": 1991,
                "baseline_end_year": 2020,
            },
        )
        assert response.status_code == 200
        data = response.json()
        validated = HeatwaveAnalysisResponse.model_validate(data)
        assert validated.location.latitude == 17.385
        assert validated.location.longitude == 78.487
        assert len(validated.annual_metrics) == 6
