"""Unit tests for request validation, error models, and response serialization."""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas.errors import ErrorResponse
from app.schemas.requests import HeatwaveAnalysisQuery, RegionSearchQuery
from app.schemas.responses import (
    AnalysisWindowDTO,
    AnnualHeatwaveMetricDTO,
    BaselineConfigDTO,
    DataQualityDTO,
    DataSourceMetadataDTO,
    GeoLocationDTO,
    HeatwaveAnalysisResponse,
    HeatwaveEventDTO,
    TrendStatisticsDTO,
)


def test_heatwave_analysis_query_valid():
    """Verify that a well-formed query parses successfully and rounds coordinates."""
    query = HeatwaveAnalysisQuery(
        latitude=52.520045,
        longitude=13.404987,
        start_year=1980,
        end_year=2020,
    )
    assert query.latitude == 52.5200
    assert query.longitude == 13.4050
    assert query.start_year == 1980
    assert query.end_year == 2020
    assert query.threshold_percentile == 95.0
    assert query.min_consecutive_days == 3


def test_heatwave_analysis_query_inverted_years():
    """Verify that start_year > end_year raises ValidationError and is not clamped."""
    with pytest.raises(ValidationError) as exc:
        HeatwaveAnalysisQuery(
            latitude=52.52,
            longitude=13.41,
            start_year=2020,
            end_year=1980,
        )
    assert "start_year (2020) cannot be greater than end_year (1980)" in str(exc.value)


def test_heatwave_analysis_query_future_year():
    """Verify that end_year exceeding current year raises ValidationError."""
    future_year = datetime.now(UTC).year + 2
    with pytest.raises(ValidationError) as exc:
        HeatwaveAnalysisQuery(
            latitude=52.52,
            longitude=13.41,
            start_year=1980,
            end_year=future_year,
        )
    assert "exceeds the current calendar year" in str(exc.value)


def test_heatwave_analysis_query_span_limit():
    """Verify that querying more than 85 years in a single request raises ValidationError."""
    with pytest.raises(ValidationError) as exc:
        HeatwaveAnalysisQuery(
            latitude=52.52,
            longitude=13.41,
            start_year=1940,
            end_year=2026,
        )
    assert "exceeds the maximum allowable range of 85 years" in str(exc.value)


def test_heatwave_analysis_query_baseline_mismatch():
    """Verify baseline validation when only one baseline boundary is provided."""
    with pytest.raises(ValidationError) as exc:
        HeatwaveAnalysisQuery(
            latitude=52.52,
            longitude=13.41,
            start_year=1980,
            end_year=2020,
            baseline_start_year=1991,
            # baseline_end_year omitted
        )
    assert "Both baseline_start_year and baseline_end_year must be provided together" in str(
        exc.value
    )


def test_region_search_query_validation():
    """Verify validation boundaries for geocoding queries."""
    with pytest.raises(ValidationError):
        RegionSearchQuery(query="a")  # Too short

    with pytest.raises(ValidationError):
        RegionSearchQuery(query="Berlin", limit=0)  # ge=1

    with pytest.raises(ValidationError):
        RegionSearchQuery(query="Berlin", limit=25)  # le=20

    valid = RegionSearchQuery(query="Tokyo", limit=10)
    assert valid.query == "Tokyo"
    assert valid.limit == 10


def test_response_serialization_with_genuine_zeros():
    """Verify complete response serialization, testing genuine zeros vs unavailable metrics."""
    response = HeatwaveAnalysisResponse(
        location=GeoLocationDTO(
            latitude=48.8566,
            longitude=2.3522,
            name="Paris",
            country="France",
        ),
        data_source=DataSourceMetadataDTO(),
        baseline=BaselineConfigDTO(
            baseline_start_year=1991,
            baseline_end_year=2020,
            percentile_threshold=95.0,
            threshold_celsius=31.2,
        ),
        analysis_window=AnalysisWindowDTO(start_year=2000, end_year=2020, total_years=21),
        data_quality=DataQualityDTO(
            total_expected_days=7671,
            observed_days=7671,
            missing_days=0,
            completeness_percentage=100.0,
            has_critical_gaps=False,
        ),
        annual_metrics=[
            AnnualHeatwaveMetricDTO(
                year=2003,
                event_count=2,
                total_heatwave_days=16,
                max_duration_days=11,
                mean_duration_days=8.0,
                cumulative_intensity_degree_days=44.5,
                peak_intensity_celsius=7.8,
                mean_peak_temperature_celsius=38.0,
            ),
            AnnualHeatwaveMetricDTO(
                year=2004,
                event_count=0,
                total_heatwave_days=0,
                max_duration_days=None,
                mean_duration_days=None,
                cumulative_intensity_degree_days=None,
                peak_intensity_celsius=None,
                mean_peak_temperature_celsius=None,
            ),
        ],
        recent_events=[
            HeatwaveEventDTO(
                start_date="2003-08-01",
                end_date="2003-08-11",
                duration_days=11,
                threshold_celsius=31.2,
                peak_temperature_celsius=39.0,
                peak_exceedance_celsius=7.8,
                cumulative_exceedance_degree_days=38.5,
                mean_exceedance_celsius=3.5,
            )
        ],
        trends={
            "annual_frequency": TrendStatisticsDTO(
                metric_name="annual_frequency",
                slope_per_decade=0.45,
                slope_per_year=0.045,
                p_value=0.012,
                direction="increasing",
                is_significant=True,
                unit="events/decade",
                sample_size_years=21,
                description="Statistically significant upward trend in annual heatwaves",
            )
        },
        insights=[
            "Heatwave frequency has increased significantly by +0.45 events per decade.",
            "The 2003 European heatwave was the most severe event recorded.",
        ],
    )

    dumped = response.model_dump()
    assert dumped["location"]["name"] == "Paris"
    assert dumped["annual_metrics"][0]["event_count"] == 2
    assert dumped["annual_metrics"][0]["max_duration_days"] == 11

    # Verify that in 2004, event_count is genuinely 0 and duration/intensity are None
    assert dumped["annual_metrics"][1]["event_count"] == 0
    assert dumped["annual_metrics"][1]["max_duration_days"] is None
    assert dumped["annual_metrics"][1]["cumulative_intensity_degree_days"] is None


def test_error_response_model():
    """Verify ErrorResponse model serialization and attributes."""
    err = ErrorResponse(
        error_code="INVALID_COORDINATES",
        message="Latitude must be between -90 and 90 degrees.",
        request_id="req-12345",
    )
    dumped = err.model_dump()
    assert dumped["error_code"] == "INVALID_COORDINATES"
    assert dumped["request_id"] == "req-12345"
    assert "timestamp" in dumped
