"""Unit tests verifying Protocol contract conformance."""
# ruff: noqa: ARG002

from datetime import date
from typing import Any

from app.domain.contracts import (
    AnalysisCacheProtocol,
    CoverageMetadataRepositoryProtocol,
    GeocodingProviderProtocol,
    HistoricalWeatherProviderProtocol,
    WeatherRepositoryProtocol,
)
from app.domain.models import BaselineConfig, DailyWeatherObservation, GeoLocation


class DummyWeatherProvider:
    """Mock provider conforming to HistoricalWeatherProviderProtocol."""

    async def fetch_historical_daily(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        return []


class DummyGeocodingProvider:
    """Mock provider conforming to GeocodingProviderProtocol."""

    async def search_locations(
        self,
        query: str,
        limit: int = 5,
    ) -> list[GeoLocation]:
        return []


class DummyWeatherRepository:
    """Mock repository conforming to WeatherRepositoryProtocol."""

    async def upsert_observations(
        self,
        location: GeoLocation,
        observations: list[DailyWeatherObservation],
    ) -> int:
        return len(observations)

    async def get_observations(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        return []

    async def get_cached_threshold(
        self,
        location: GeoLocation,
        baseline: BaselineConfig,
    ) -> float | None:
        return 30.0

    async def save_cached_threshold(
        self,
        location: GeoLocation,
        baseline: BaselineConfig,
        threshold_celsius: float,
    ) -> None:
        pass


class DummyAnalysisCache:
    """Mock cache conforming to AnalysisCacheProtocol."""

    async def get_analysis(self, cache_key: str) -> dict[str, Any] | None:
        return None

    async def set_analysis(
        self,
        cache_key: str,
        data: dict[str, Any],
        ttl_seconds: int = 3600,
    ) -> None:
        pass

    async def invalidate(self, pattern: str) -> int:
        return 0


class DummyCoverageRepository:
    """Mock repository conforming to CoverageMetadataRepositoryProtocol."""

    async def get_coverage(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> tuple[date, date] | None:
        return (date(1990, 1, 1), date(2020, 12, 31))

    async def record_coverage(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        record_count: int,
        schema_version: str = "v1",
        model: str = "ERA5",
    ) -> None:
        pass

    async def get_dataset_version(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> str:
        return "rev1_mock"


def test_protocols_conformance():
    """Verify dummy classes and real adapters satisfy runtime Protocol checks."""
    assert isinstance(DummyWeatherProvider(), HistoricalWeatherProviderProtocol)
    assert isinstance(DummyGeocodingProvider(), GeocodingProviderProtocol)
    assert isinstance(DummyWeatherRepository(), WeatherRepositoryProtocol)
    assert isinstance(DummyAnalysisCache(), AnalysisCacheProtocol)
    assert isinstance(DummyCoverageRepository(), CoverageMetadataRepositoryProtocol)

    # Real client adapter protocol conformance
    from app.clients.open_meteo import (
        OpenMeteoGeocodingClient,
        OpenMeteoHistoricalWeatherClient,
    )

    assert isinstance(OpenMeteoHistoricalWeatherClient(), HistoricalWeatherProviderProtocol)
    assert isinstance(OpenMeteoGeocodingClient(), GeocodingProviderProtocol)
