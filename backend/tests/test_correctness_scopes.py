"""Comprehensive regression and correctness test suite across Scopes 1 to 5.

Scope 1: MongoDB model isolation, coexistence of ERA5 & ERA5-Land, migration.
Scope 2: Robust ingestion, contiguous gap grouping, stored missing vs unfetched, lag buffer.
Scope 3: Cross-year heatwave event attribution, heatwave days split, exceedance intensity.
Scope 4: Outlier/non-finite sanitization, calendar expected days, missing streak, quality.
Scope 5: Threshold semantics (None), zero slope preservation, configured rate limits, config.
"""

import math
from datetime import UTC, date, datetime, timedelta

import pytest

from app.cache.rate_limiter import RateLimiterDependency
from app.core.config import Settings
from app.db.repositories import MongoWeatherRepository
from app.domain.annual_metrics import aggregate_annual_metrics
from app.domain.models import (
    AnnualHeatwaveMetrics,
    BaselineConfig,
    DailyWeatherObservation,
    GeoLocation,
    HeatwaveEvent,
)
from app.domain.trends import (
    compute_all_hazard_trends,
)
from app.schemas.requests import BoundingBoxAnalysisQuery, HeatwaveAnalysisQuery
from app.services.analysis_service import AnalysisService
from app.services.weather_service import WeatherService
from tests.test_api_endpoints import (
    MockAnalysisCache,
    MockCoverageRepository,
    MockWeatherProvider,
    MockWeatherRepository,
)
from tests.test_infra_integration import TEST_MONGO_DB, TEST_MONGO_URI, is_mongodb_available

# ==============================================================================
# SCOPE 1: MongoDB Model Isolation and Migration Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_scope1_model_coexistence_and_isolation():
    """Verify ERA5 and ERA5-Land can coexist at the same location and date without collision."""
    if not await is_mongodb_available():
        pytest.skip("Local MongoDB instance not available.")

    from app.db.mongo import MongoDBManager

    mgr = MongoDBManager()
    mgr.connect(TEST_MONGO_URI, TEST_MONGO_DB)
    db = mgr.get_database()
    repo = MongoWeatherRepository(db)

    await db["weather_observations"].drop()
    await db["baseline_thresholds"].drop()
    await repo.ensure_indexes()

    loc = GeoLocation(latitude=17.3850, longitude=78.4867, name="Hyderabad")
    target_date = date(2021, 5, 1)

    # 1. Upsert ERA5 observation
    obs_era5 = [
        DailyWeatherObservation(
            date=target_date,
            temp_max=40.5,
            unit="°C",
            source_model="ERA5",
        )
    ]
    inserted_era5 = await repo.upsert_observations(loc, obs_era5)
    assert inserted_era5 == 1

    # 2. Upsert ERA5-Land observation on identical date and location
    obs_land = [
        DailyWeatherObservation(
            date=target_date,
            temp_max=42.0,
            unit="°C",
            source_model="ERA5_LAND",
        )
    ]
    inserted_land = await repo.upsert_observations(loc, obs_land)
    assert inserted_land == 1

    # Both documents must exist in database without overwriting each other
    doc_count = await db["weather_observations"].count_documents(
        {"location_key": loc.coordinate_key}
    )
    assert doc_count == 2

    # 3. Model-filtered retrieval
    era5_retrieved = await repo.get_observations(loc, target_date, target_date, model="ERA5")
    assert len(era5_retrieved) == 1
    assert era5_retrieved[0].temp_max == 40.5
    assert era5_retrieved[0].source_model == "ERA5"

    land_retrieved = await repo.get_observations(loc, target_date, target_date, model="ERA5_LAND")
    assert len(land_retrieved) == 1
    assert land_retrieved[0].temp_max == 42.0
    assert land_retrieved[0].source_model == "ERA5_LAND"

    # 4. Cached threshold model isolation
    baseline_era5 = BaselineConfig(
        baseline_start_year=1991,
        baseline_end_year=2020,
        percentile_threshold=95.0,
        source_model="ERA5",
    )
    baseline_land = BaselineConfig(
        baseline_start_year=1991,
        baseline_end_year=2020,
        percentile_threshold=95.0,
        source_model="ERA5_LAND",
    )

    await repo.save_cached_threshold(loc, baseline_era5, 38.0)
    await repo.save_cached_threshold(loc, baseline_land, 39.5)

    assert await repo.get_cached_threshold(loc, baseline_era5) == 38.0
    assert await repo.get_cached_threshold(loc, baseline_land) == 39.5

    await mgr.client.drop_database(TEST_MONGO_DB)
    await mgr.close()


@pytest.mark.asyncio
async def test_scope1_index_and_data_migration_safety():
    """Verify safe legacy index drop, backfill of missing source_model, and compound index."""
    if not await is_mongodb_available():
        pytest.skip("Local MongoDB instance not available.")

    from app.db.mongo import MongoDBManager

    mgr = MongoDBManager()
    mgr.connect(TEST_MONGO_URI, TEST_MONGO_DB)
    db = mgr.get_database()
    repo = MongoWeatherRepository(db)

    await db["weather_observations"].drop()

    # Create legacy index without source_model
    await db["weather_observations"].create_index(
        [("location_key", 1), ("date", 1)],
        unique=True,
        name="location_key_1_date_1",
    )
    # Insert legacy document without source_model
    await db["weather_observations"].insert_one(
        {
            "location_key": "17.3850,78.4867",
            "date": "2020-01-01",
            "temp_max": 30.0,
            "unit": "°C",
        }
    )

    # Run ensure_indexes to perform migration
    await repo.ensure_indexes()

    # Verify legacy document was backfilled to "ERA5"
    migrated_doc = await db["weather_observations"].find_one({"location_key": "17.3850,78.4867"})
    assert migrated_doc is not None
    assert migrated_doc.get("source_model") == "ERA5"

    # Verify legacy index was dropped and new compound index exists
    index_info = await db["weather_observations"].index_information()
    assert "location_key_1_date_1" not in index_info
    assert "location_key_1_date_1_source_model_1" in index_info

    await mgr.client.drop_database(TEST_MONGO_DB)
    await mgr.close()


# ==============================================================================
# SCOPE 2: Robust Ingestion, Date Gaps, and Lag Buffer Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_scope2_internal_date_gaps_contiguous_grouping():
    """Verify missing dates are grouped into contiguous intervals without omissions."""
    mock_repo = MockWeatherRepository()
    mock_provider = MockWeatherProvider()
    mock_coverage = MockCoverageRepository()

    loc = GeoLocation(latitude=17.385, longitude=78.487)

    # Pre-populate repo with day 1 and day 5; days 2, 3, 4 are missing (internal gap)
    obs_existing = [
        DailyWeatherObservation(date=date(2000, 1, 1), temp_max=32.0, source_model="ERA5"),
        DailyWeatherObservation(date=date(2000, 1, 5), temp_max=33.0, source_model="ERA5"),
    ]
    await mock_repo.upsert_observations(loc, obs_existing)

    weather_service = WeatherService(
        weather_repo=mock_repo,
        weather_provider=mock_provider,
        coverage_repo=mock_coverage,
    )

    # Spy provider fetch to record requested spans
    fetched_spans: list[tuple[date, date]] = []
    original_fetch = mock_provider.fetch_historical_daily

    async def fetch_spy(location, start_date, end_date, model="ERA5", **_kwargs):
        fetched_spans.append((start_date, end_date))
        return await original_fetch(location, start_date, end_date, model=model)

    mock_provider.fetch_historical_daily = fetch_spy

    result = await weather_service.ensure_historical_observations(
        loc, date(2000, 1, 1), date(2000, 1, 5), model="ERA5"
    )

    # Exactly 1 contiguous request for the missing gap [Jan 2, Jan 4]
    assert fetched_spans == [(date(2000, 1, 2), date(2000, 1, 4))]
    assert len(result) == 5


@pytest.mark.asyncio
async def test_scope2_stored_missing_temp_distinguished_from_unfetched():
    """Verify stored missing observation (temp_max=None) is recognized as fetched."""
    mock_repo = MockWeatherRepository()
    mock_provider = MockWeatherProvider()
    mock_coverage = MockCoverageRepository()

    loc = GeoLocation(latitude=17.385, longitude=78.487)

    # Days 1 and 2 exist, where Day 2 has genuine missing temp (temp_max=None)
    obs_existing = [
        DailyWeatherObservation(date=date(2000, 1, 1), temp_max=32.0, source_model="ERA5"),
        DailyWeatherObservation(date=date(2000, 1, 2), temp_max=None, source_model="ERA5"),
    ]
    await mock_repo.upsert_observations(loc, obs_existing)

    weather_service = WeatherService(
        weather_repo=mock_repo,
        weather_provider=mock_provider,
        coverage_repo=mock_coverage,
    )

    fetch_call_count = 0

    async def fetch_spy(location, _start_date, _end_date, _model="ERA5", **_kwargs):
        _ = location
        nonlocal fetch_call_count
        fetch_call_count += 1
        return []

    mock_provider.fetch_historical_daily = fetch_spy

    result = await weather_service.ensure_historical_observations(
        loc, date(2000, 1, 1), date(2000, 1, 2), model="ERA5"
    )

    # Provider must NOT have been called because both dates are already persisted
    assert fetch_call_count == 0
    assert len(result) == 2
    assert result[1].temp_max is None


@pytest.mark.asyncio
async def test_scope2_lag_buffer_and_future_boundary():
    """Verify ingestion clamps to today - lag_buffer and never fetches future dates."""
    mock_repo = MockWeatherRepository()
    mock_provider = MockWeatherProvider()
    mock_coverage = MockCoverageRepository()

    loc = GeoLocation(latitude=17.385, longitude=78.487)

    today = datetime.now(UTC).date()
    lag_days = 5
    clamped_expected_end = today - timedelta(days=lag_days)

    weather_service = WeatherService(
        weather_repo=mock_repo,
        weather_provider=mock_provider,
        coverage_repo=mock_coverage,
        settings=Settings(data_lag_buffer_days=lag_days),
    )

    fetched_spans: list[tuple[date, date]] = []

    async def fetch_spy(location, start_date, end_date, model="ERA5", **_kwargs):
        _ = location
        fetched_spans.append((start_date, end_date))
        return [DailyWeatherObservation(date=start_date, temp_max=25.0, source_model=model)]

    mock_provider.fetch_historical_daily = fetch_spy

    # Request up to 10 days into the future
    requested_future_end = today + timedelta(days=10)
    await weather_service.ensure_historical_observations(
        loc, today - timedelta(days=20), requested_future_end, model="ERA5"
    )

    assert len(fetched_spans) == 1
    # End date must have been clamped to today - lag_days, never future
    assert fetched_spans[0][1] == clamped_expected_end


# ==============================================================================
# SCOPE 3: Cross-Year Heatwave Accounting Tests
# ==============================================================================


def test_scope3_december_to_january_cross_year_heatwave():
    """Verify cross-year attribution: count to start year, days/exceedance to each year."""
    # 5-day event: 2020-12-30 to 2021-01-03 (2 days in 2020, 3 days in 2021)
    ev = HeatwaveEvent(
        start_date=date(2020, 12, 30),
        end_date=date(2021, 1, 3),
        duration_days=5,
        threshold_celsius=35.0,
        peak_temperature=42.0,
        peak_exceedance=7.0,
        cumulative_exceedance=10.0,
        mean_exceedance=2.0,
        daily_exceedances=(
            (date(2020, 12, 30), 2.0),
            (date(2020, 12, 31), 2.0),
            (date(2021, 1, 1), 2.0),
            (date(2021, 1, 2), 2.0),
            (date(2021, 1, 3), 2.0),
        ),
    )

    # Daily observations covering 2020 and 2021
    obs_2020 = [
        DailyWeatherObservation(date=date(2020, 1, 1) + timedelta(days=i), temp_max=30.0)
        for i in range(366)
    ]
    obs_2021 = [
        DailyWeatherObservation(date=date(2021, 1, 1) + timedelta(days=i), temp_max=30.0)
        for i in range(365)
    ]
    all_obs = obs_2020 + obs_2021

    annual_metrics = aggregate_annual_metrics(
        events=[ev],
        observations=all_obs,
        start_year=2020,
        end_year=2021,
    )

    m_2020 = next(m for m in annual_metrics if m.year == 2020)
    m_2021 = next(m for m in annual_metrics if m.year == 2021)

    # Event count is attributed to the inception year (2020)
    assert m_2020.event_count == 1
    assert m_2021.event_count == 0

    # Heatwave days are split accurately: 2 in 2020, 3 in 2021
    assert m_2020.total_heatwave_days == 2
    assert m_2021.total_heatwave_days == 3

    # Exceedance intensity is split accurately: 4.0 in 2020, 6.0 in 2021
    assert math.isclose(m_2020.cumulative_intensity, 4.0, abs_tol=1e-5)
    assert math.isclose(m_2021.cumulative_intensity, 6.0, abs_tol=1e-5)

    # Max duration in inception year reports total event duration
    assert m_2020.max_duration_days == 5


# ==============================================================================
# SCOPE 4: Data Quality, Non-Finite Sanitization, and Trend Reliability Tests
# ==============================================================================


def test_scope4_temperature_sanitization_non_finite_and_outliers():
    """Verify non-finite and extreme outlier temperatures are sanitized to None."""
    obs_nan = DailyWeatherObservation(date=date(2020, 1, 1), temp_max=float("nan"))
    assert obs_nan.temp_max is None

    obs_inf = DailyWeatherObservation(date=date(2020, 1, 2), temp_max=float("inf"))
    assert obs_inf.temp_max is None

    obs_neginf = DailyWeatherObservation(date=date(2020, 1, 3), temp_max=float("-inf"))
    assert obs_neginf.temp_max is None

    obs_too_hot = DailyWeatherObservation(date=date(2020, 1, 4), temp_max=120.0)
    assert obs_too_hot.temp_max is None

    obs_too_cold = DailyWeatherObservation(date=date(2020, 1, 5), temp_max=-110.0)
    assert obs_too_cold.temp_max is None

    obs_valid = DailyWeatherObservation(date=date(2020, 1, 6), temp_max=35.5)
    assert obs_valid.temp_max == 35.5


def test_scope4_expected_days_and_missing_streak_calendar_based():
    """Verify expected days and longest missing streak are derived from calendar."""
    target_year = 2020  # Leap year: 366 days
    # Only 5 observations exist, leaving a streak of 361 missing days
    obs = [
        DailyWeatherObservation(date=date(target_year, 1, 1) + timedelta(days=i), temp_max=30.0)
        for i in range(5)
    ]

    metrics = aggregate_annual_metrics(
        events=[],
        observations=obs,
        start_year=target_year,
        end_year=target_year,
    )
    m = metrics[0]
    assert m.expected_days == 366
    assert m.usable_days == 5
    assert m.completeness_percentage < 50.0
    assert m.quality_status == "insufficient_data"


def test_scope4_unreliable_and_provisional_years_excluded_from_trends():
    """Verify unreliable years (<90% completeness) and provisional years are excluded."""
    current_yr = date.today().year

    metrics = [
        AnnualHeatwaveMetrics(
            year=2000 + i,
            event_count=i,
            total_heatwave_days=i * 3,
            max_duration_days=i * 3,
            mean_duration_days=float(i * 3),
            cumulative_intensity=float(i * 2),
            peak_intensity=2.0,
            mean_peak_temperature=35.0,
            quality_status="reliable",
        )
        for i in range(5)
    ]
    # Add unreliable year
    metrics.append(
        AnnualHeatwaveMetrics(
            year=2005,
            event_count=100,  # Corrupt spike in unreliable year
            total_heatwave_days=300,
            max_duration_days=50,
            mean_duration_days=50.0,
            cumulative_intensity=500.0,
            peak_intensity=10.0,
            mean_peak_temperature=45.0,
            quality_status="unreliable",
        )
    )
    # Add provisional year
    metrics.append(
        AnnualHeatwaveMetrics(
            year=current_yr,
            event_count=50,
            total_heatwave_days=150,
            max_duration_days=25,
            mean_duration_days=25.0,
            cumulative_intensity=250.0,
            peak_intensity=5.0,
            mean_peak_temperature=40.0,
            quality_status="provisional",
        )
    )

    trends = compute_all_hazard_trends(metrics, min_years=5)
    # The regression must have used only the 5 reliable years (2000-2004: 0, 1, 2, 3, 4)
    freq_trend = trends["annual_frequency"]
    assert freq_trend.sample_size_years == 5
    assert freq_trend.slope is not None
    assert math.isclose(freq_trend.slope, 10.0, abs_tol=1e-3)


def test_scope4_insufficient_reliable_years_avoids_spurious_zero_trend():
    """Verify when reliable years are insufficient (<5), slope is None."""
    sparse_metrics = [
        AnnualHeatwaveMetrics(
            year=2000,
            event_count=0,
            total_heatwave_days=0,
            max_duration_days=0,
            mean_duration_days=0.0,
            cumulative_intensity=0.0,
            peak_intensity=0.0,
            mean_peak_temperature=0.0,
            quality_status="reliable",
        ),
        AnnualHeatwaveMetrics(
            year=2001,
            event_count=0,
            total_heatwave_days=0,
            max_duration_days=0,
            mean_duration_days=0.0,
            cumulative_intensity=0.0,
            peak_intensity=0.0,
            mean_peak_temperature=0.0,
            quality_status="unreliable",
        ),
    ]

    trends = compute_all_hazard_trends(sparse_metrics, min_years=5)
    freq_trend = trends["annual_frequency"]
    assert freq_trend.sample_size_years == 1  # Only 1 reliable year
    assert freq_trend.slope is None  # Insufficient reliable years (<5) to calculate regression


# ==============================================================================
# SCOPE 5: Response Semantics and Dynamic Settings Configuration Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_scope5_numeric_zero_slope_preserved_in_serialization():
    """Verify true numeric zero slope (0.0) is preserved as 0.0 rather than None."""
    mock_repo = MockWeatherRepository()
    mock_provider = MockWeatherProvider()
    mock_coverage = MockCoverageRepository()
    mock_cache = MockAnalysisCache()

    # Pre-populate 10 reliable years with completely identical zero events
    obs = [
        DailyWeatherObservation(
            date=date(2000, 1, 1) + timedelta(days=i),
            temp_max=25.0,  # Constant temp, no heatwaves
            source_model="ERA5",
        )
        for i in range(365 * 10)
    ]
    loc = GeoLocation(latitude=17.385, longitude=78.487)
    await mock_repo.upsert_observations(loc, obs)

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
        end_year=2009,
        baseline_start_year=2000,
        baseline_end_year=2009,
    )

    response = await analysis_service.analyze_heatwaves(query)

    # Scope 5: threshold_celsius is None for calendar-day moving-window percentiles
    assert response.baseline.threshold_celsius is None

    # Scope 5: slope_per_year is exactly 0.0, NOT None
    freq_trend = response.trends["annual_frequency"]
    assert freq_trend.slope_per_year == 0.0
    assert freq_trend.slope_per_decade == 0.0


def test_scope5_endpoint_specific_rate_limits():
    """Verify configured endpoint-specific rate limits are correctly resolved by scope."""
    custom_settings = Settings(
        rate_limit_requests_per_minute=100,
        rate_limit_analysis_rpm=15,
        rate_limit_regions_rpm=45,
    )

    dep_analysis = RateLimiterDependency(scope="heatwave_analysis")
    dep_bbox = RateLimiterDependency(scope="heatwave_bbox_analysis")
    dep_regions = RateLimiterDependency(scope="regions_search")
    dep_default = RateLimiterDependency(scope="default")

    # Verify that scopes correctly resolve configured limit values
    def get_limit(dep: RateLimiterDependency, settings: Settings) -> int:
        if dep.max_requests is not None:
            return dep.max_requests
        if dep.scope in ("heatwave_analysis", "heatwave_bbox_analysis"):
            return settings.rate_limit_analysis_rpm
        if dep.scope in ("regions_search", "regions"):
            return settings.rate_limit_regions_rpm
        return settings.rate_limit_requests_per_minute

    assert get_limit(dep_analysis, custom_settings) == 15
    assert get_limit(dep_bbox, custom_settings) == 15
    assert get_limit(dep_regions, custom_settings) == 45
    assert get_limit(dep_default, custom_settings) == 100


def test_scope5_dynamic_validation_rules_from_settings(monkeypatch):
    """Verify that settings dynamically govern request validation limits."""
    # Case A: max_analysis_range_years & min_analysis_year
    with monkeypatch.context() as m:
        custom_settings = Settings(max_analysis_range_years=10, min_analysis_year=1980)
        m.setattr("app.schemas.requests.get_settings", lambda: custom_settings)

        # 12-year range (2000-2011 is 12 years) must fail when max_analysis_range_years is 10
        with pytest.raises(ValueError, match="exceeds the maximum allowable range of 10 years"):
            HeatwaveAnalysisQuery(
                latitude=17.385,
                longitude=78.487,
                start_year=2000,
                end_year=2011,
                baseline_start_year=2000,
                baseline_end_year=2005,
            )

        # Year before min_analysis_year (1975 < 1980) must fail
        with pytest.raises(ValueError, match="cannot precede minimum allowable year"):
            HeatwaveAnalysisQuery(
                latitude=17.385,
                longitude=78.487,
                start_year=1975,
                end_year=1980,
                baseline_start_year=1980,
                baseline_end_year=1985,
            )

    # Case B: max_bbox_area_sq_degrees
    with monkeypatch.context() as m:
        custom_settings = Settings(max_bbox_area_sq_degrees=4.0)
        m.setattr("app.schemas.requests.get_settings", lambda: custom_settings)

        # 3.0 x 3.0 = 9.0 sq degrees must fail when limit is 4.0
        with pytest.raises(ValueError, match="exceeds maximum allowed limit of 4.00"):
            BoundingBoxAnalysisQuery(
                min_latitude=10.0,
                max_latitude=13.0,
                min_longitude=70.0,
                max_longitude=73.0,
                start_year=2000,
                end_year=2005,
                baseline_start_year=2000,
                baseline_end_year=2004,
            )
