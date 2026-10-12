"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration validated from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application settings
    app_name: str = Field(
        default="Climate Hazard Trend Analyzer",
        description="Name of the application",
    )
    environment: Literal["development", "staging", "production", "testing"] = Field(
        default="development",
        description="Deployment environment",
    )
    debug: bool = Field(default=False, description="Debug mode flag")
    host: str = Field(default="0.0.0.0", description="Host to bind server")
    port: int = Field(default=8000, ge=1, le=65535, description="Port to bind server")

    # MongoDB settings
    mongodb_uri: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URI",
    )
    mongodb_db_name: str = Field(
        default="climate_hazards",
        description="MongoDB database name",
    )
    mongodb_min_pool_size: int = Field(default=10, ge=1)
    mongodb_max_pool_size: int = Field(default=50, ge=1)
    mongodb_server_selection_timeout_ms: int = Field(default=5000, ge=100)

    # Redis settings
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
    )
    redis_socket_timeout: float = Field(default=5.0, ge=0.1)
    redis_socket_connect_timeout: float = Field(default=5.0, ge=0.1)

    # Open-Meteo API settings
    open_meteo_api_key: str | None = Field(
        default=None,
        description="Optional Open-Meteo Commercial API key",
    )
    open_meteo_historical_api_url: str = Field(
        default="https://archive-api.open-meteo.com/v1/archive",
        description="Open-Meteo Historical Weather API base endpoint",
    )
    open_meteo_geocoding_api_url: str = Field(
        default="https://geocoding-api.open-meteo.com/v1/search",
        description="Open-Meteo Geocoding API search endpoint",
    )

    # HTTP client resiliency settings
    http_timeout_seconds: float = Field(
        default=30.0,
        gt=0,
        description="Timeout for outgoing HTTP requests in seconds",
    )
    http_max_retries: int = Field(
        default=3,
        ge=0,
        description="Maximum retry attempts for idempotent API calls",
    )
    http_backoff_factor: float = Field(
        default=0.5,
        ge=0.1,
        description="Exponential backoff factor for retries",
    )

    # Climate analysis & baseline bounds
    baseline_start_year: int = Field(
        default=1991,
        ge=1940,
        description="Start year for climatological reference baseline (ERA5 begins 1940)",
    )
    baseline_end_year: int = Field(
        default=2020,
        ge=1940,
        description="End year for climatological reference baseline",
    )
    min_analysis_year: int = Field(
        default=1940,
        ge=1940,
        description="Earliest allowable year for historical data analysis",
    )
    max_analysis_range_years: int = Field(
        default=85,
        ge=1,
        le=150,
        description="Maximum permitted analysis span in years per single request",
    )
    data_lag_buffer_days: int = Field(
        default=5,
        ge=0,
        description="Buffer in days from current date due to ERA5 reanalysis lag",
    )

    # Bounding box spatial analysis limits
    max_bbox_area_sq_degrees: float = Field(
        default=25.0,
        gt=0,
        description="Maximum permitted bounding box area in square degrees (~500km x 500km)",
    )
    max_bbox_sample_points: int = Field(
        default=9,
        ge=1,
        le=25,
        description="Maximum spatial sample points generated within a bounding box",
    )
    min_bbox_point_coverage_ratio: float = Field(
        default=0.60,
        ge=0.1,
        le=1.0,
        description="Minimum fraction of grid points required to establish a valid regional day",
    )

    # Rate limiting & caching
    rate_limit_enabled: bool = Field(
        default=True,
        description="Toggle for API rate limiting",
    )
    rate_limit_requests_per_minute: int = Field(
        default=60,
        ge=1,
        description="Default maximum API requests allowed per client per minute",
    )
    rate_limit_window_seconds: int = Field(
        default=60,
        ge=1,
        description="Rate limit sliding/fixed time window in seconds",
    )
    rate_limit_analysis_rpm: int = Field(
        default=30,
        ge=1,
        description="Rate limit requests per minute for expensive heatwave analysis",
    )
    rate_limit_regions_rpm: int = Field(
        default=60,
        ge=1,
        description="Rate limit requests per minute for region geocoding search",
    )
    trusted_proxies: list[str] = Field(
        default=[],
        description="List of trusted reverse proxy IP addresses for client identification",
    )

    # Caching & versioning
    cache_ttl_seconds: int = Field(
        default=86400,
        ge=60,
        description="Default TTL in seconds for cached analysis results",
    )
    analysis_algorithm_version: str = Field(
        default="v1.0.0",
        description="Version string for climate hazard analysis algorithm and schema",
    )

    # CORS settings
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173", "http://localhost:8000"],
        description="List of allowed CORS origins",
    )

    @field_validator("cors_origins", "trusted_proxies", mode="before")
    @classmethod
    def assemble_string_lists(cls, value: str | list[str]) -> list[str]:
        """Parse comma-separated strings or JSON arrays into list of strings."""
        if isinstance(value, str):
            if value.startswith("[") and value.endswith("]"):
                import json

                try:
                    return json.loads(value)
                except Exception:
                    pass
            return [i.strip() for i in value.split(",") if i.strip()]
        return value

    @model_validator(mode="after")
    def validate_baseline_period(self) -> "Settings":
        """Validate that baseline start year strictly precedes baseline end year."""
        if self.baseline_start_year >= self.baseline_end_year:
            raise ValueError(
                f"baseline_start_year ({self.baseline_start_year}) must be strictly less than "
                f"baseline_end_year ({self.baseline_end_year})"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton provider."""
    return Settings()
