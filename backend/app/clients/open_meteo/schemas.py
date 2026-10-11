"""Pydantic validation schemas for raw Open-Meteo API payloads."""

from pydantic import BaseModel, ConfigDict, Field


class OpenMeteoDailyUnits(BaseModel):
    """Units dictionary returned by Open-Meteo."""

    model_config = ConfigDict(extra="ignore")

    time: str | None = None
    temperature_2m_max: str | None = None


class OpenMeteoDailyData(BaseModel):
    """Daily timeseries arrays."""

    model_config = ConfigDict(extra="ignore")

    time: list[str] = Field(..., description="List of ISO-8601 date strings (YYYY-MM-DD)")
    temperature_2m_max: list[float | None] = Field(
        ...,
        description="Daily maximum temperatures (null represents missing measurement)",
    )


class OpenMeteoHistoricalResponse(BaseModel):
    """Schema for validating Open-Meteo Historical Weather API response."""

    model_config = ConfigDict(extra="ignore")

    latitude: float
    longitude: float
    generationtime_ms: float | None = None
    utc_offset_seconds: int | None = None
    timezone: str | None = None
    timezone_abbreviation: str | None = None
    elevation: float | None = None
    daily_units: OpenMeteoDailyUnits | None = None
    daily: OpenMeteoDailyData


class OpenMeteoGeocodingLocation(BaseModel):
    """Individual location item in Geocoding search response."""

    model_config = ConfigDict(extra="ignore")

    id: int | None = None
    name: str
    latitude: float
    longitude: float
    elevation: float | None = None
    country: str | None = None
    country_code: str | None = None
    admin1: str | None = None
    timezone: str = "UTC"


class OpenMeteoGeocodingResponse(BaseModel):
    """Schema for validating Open-Meteo Geocoding search response."""

    model_config = ConfigDict(extra="ignore")

    results: list[OpenMeteoGeocodingLocation] = Field(default_factory=list)
    generationtime_ms: float | None = None
