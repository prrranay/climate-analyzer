"""Tests for configuration parsing and validation."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_default_settings():
    """Verify default configuration attributes are properly set."""
    settings = Settings()
    assert settings.app_name == "Climate Hazard Trend Analyzer"
    assert settings.baseline_start_year == 1991
    assert settings.baseline_end_year == 2020
    assert settings.max_analysis_range_years == 85
    assert settings.data_lag_buffer_days == 5
    assert settings.http_timeout_seconds == 30.0
    assert settings.rate_limit_enabled is True
    assert "https://archive-api.open-meteo.com/v1/archive" in settings.open_meteo_historical_api_url


def test_baseline_validation_failure():
    """Verify that invalid baseline year order raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(baseline_start_year=2020, baseline_end_year=1990)
    assert "baseline_start_year" in str(exc_info.value)


def test_cors_origins_parsing():
    """Verify comma-separated and JSON string parsing for CORS origins."""
    settings_csv = Settings(cors_origins="http://example.com,http://test.com")
    assert settings_csv.cors_origins == ["http://example.com", "http://test.com"]

    settings_json = Settings(cors_origins='["http://alpha.com", "http://beta.com"]')
    assert settings_json.cors_origins == ["http://alpha.com", "http://beta.com"]
