"""Unit tests for domain models and business value objects."""

from datetime import date

import pytest

from app.domain.models import (
    AnnualHeatwaveMetrics,
    BaselineConfig,
    DailyWeatherObservation,
    GeoLocation,
    HeatwaveEvent,
)


def test_geolocation_valid():
    """Verify valid GeoLocation creation and coordinate key."""
    loc = GeoLocation(latitude=52.52001, longitude=13.40499, name="Berlin", country="Germany")
    assert loc.latitude == 52.52001
    assert loc.longitude == 13.40499
    assert loc.coordinate_key == "52.5200,13.4050"


def test_geolocation_invalid_latitude():
    """Verify out-of-range latitude triggers ValueError."""
    with pytest.raises(ValueError, match="Latitude must be in range"):
        GeoLocation(latitude=91.0, longitude=0.0)


def test_geolocation_invalid_longitude():
    """Verify out-of-range longitude triggers ValueError."""
    with pytest.raises(ValueError, match="Longitude must be in range"):
        GeoLocation(latitude=0.0, longitude=180.1)


def test_daily_weather_observation_validity():
    """Verify differentiation between measured temperatures and missing data."""
    valid_obs = DailyWeatherObservation(date=date(2023, 7, 1), temp_max=32.5, temp_min=18.0)
    assert valid_obs.is_valid is True
    assert valid_obs.temp_max == 32.5

    # Genuine 0.0 degree temperature is valid
    zero_obs = DailyWeatherObservation(date=date(2023, 1, 1), temp_max=0.0)
    assert zero_obs.is_valid is True
    assert zero_obs.temp_max == 0.0

    # Missing observation
    missing_obs = DailyWeatherObservation(date=date(2023, 7, 2), temp_max=None)
    assert missing_obs.is_valid is False
    assert missing_obs.temp_max is None


def test_baseline_config_validation():
    """Verify baseline rules enforcement."""
    config = BaselineConfig(
        baseline_start_year=1991, baseline_end_year=2020, percentile_threshold=95.0
    )
    assert config.baseline_start_year == 1991
    assert config.baseline_end_year == 2020

    with pytest.raises(ValueError, match="must strictly precede"):
        BaselineConfig(baseline_start_year=2020, baseline_end_year=1991)

    with pytest.raises(ValueError, match="percentile_threshold must be between"):
        BaselineConfig(
            baseline_start_year=1991,
            baseline_end_year=2020,
            percentile_threshold=100.0,
        )


def test_heatwave_event_validation():
    """Verify heatwave event invariants."""
    event = HeatwaveEvent(
        start_date=date(2023, 7, 10),
        end_date=date(2023, 7, 14),
        duration_days=5,
        threshold_celsius=30.0,
        peak_temperature=35.5,
        peak_exceedance=5.5,
        cumulative_exceedance=18.2,
        mean_exceedance=3.64,
    )
    assert event.duration_days == 5
    assert event.peak_exceedance == 5.5

    with pytest.raises(ValueError, match="cannot follow end_date"):
        HeatwaveEvent(
            start_date=date(2023, 7, 15),
            end_date=date(2023, 7, 10),
            duration_days=5,
            threshold_celsius=30.0,
            peak_temperature=35.5,
            peak_exceedance=5.5,
            cumulative_exceedance=18.2,
            mean_exceedance=3.64,
        )


def test_annual_heatwave_metrics_genuine_zeros():
    """Verify that genuine zero event counts keep metrics as None rather than 0."""
    no_events = AnnualHeatwaveMetrics(
        year=2020,
        event_count=0,
        total_heatwave_days=0,
        max_duration_days=None,
        mean_duration_days=None,
        cumulative_intensity=None,
        peak_intensity=None,
        mean_peak_temperature=None,
    )
    assert no_events.event_count == 0
    assert no_events.total_heatwave_days == 0
    assert no_events.max_duration_days is None
    assert no_events.peak_intensity is None
