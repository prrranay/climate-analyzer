"""Domain contracts and interfaces (Protocols).

Narrow abstractions designed for dependency injection and provider swappability
without unnecessary boilerplate.
"""

from datetime import date
from typing import Any, Protocol, runtime_checkable

from app.domain.models import BaselineConfig, DailyWeatherObservation, GeoLocation


@runtime_checkable
class HistoricalWeatherProviderProtocol(Protocol):
    """Protocol for fetching historical weather observations from remote reanalysis APIs."""

    async def fetch_historical_daily(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        """Fetch daily weather observations for a given location and date span."""
        ...


@runtime_checkable
class GeocodingProviderProtocol(Protocol):
    """Protocol for searching geographic locations and coordinates."""

    async def search_locations(
        self,
        query: str,
        limit: int = 5,
    ) -> list[GeoLocation]:
        """Search for locations matching a text query."""
        ...


@runtime_checkable
class WeatherRepositoryProtocol(Protocol):
    """Protocol for persistent storage and retrieval of weather observations."""

    async def upsert_observations(
        self,
        location: GeoLocation,
        observations: list[DailyWeatherObservation],
    ) -> int:
        """Upsert daily weather observations idempotently and return affected count."""
        ...

    async def get_observations(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        """Retrieve daily observations within a date range for a specific model."""
        ...

    async def get_cached_threshold(
        self,
        location: GeoLocation,
        baseline: BaselineConfig,
    ) -> float | None:
        """Retrieve precomputed baseline threshold if available."""
        ...

    async def save_cached_threshold(
        self,
        location: GeoLocation,
        baseline: BaselineConfig,
        threshold_celsius: float,
    ) -> None:
        """Store precomputed baseline threshold."""
        ...


@runtime_checkable
class AnalysisCacheProtocol(Protocol):
    """Protocol for caching computed hazard analyses and temporary results."""

    async def get_analysis(self, cache_key: str) -> dict[str, Any] | None:
        """Retrieve cached analysis JSON payload."""
        ...

    async def set_analysis(
        self,
        cache_key: str,
        data: dict[str, Any],
        ttl_seconds: int = 3600,
    ) -> None:
        """Persist analysis result with an expiration TTL."""
        ...

    async def invalidate(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern and return count of deleted keys."""
        ...


@runtime_checkable
class CoverageMetadataRepositoryProtocol(Protocol):
    """Protocol for tracking ingested temporal coverage and schema versions
    for safe cache invalidation.
    """

    async def get_coverage(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> tuple[date, date] | None:
        """Return the contiguous ingested date bounds (min_date, max_date) for a location."""
        ...

    async def record_coverage(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        record_count: int,
        schema_version: str = "v1",
        model: str = "ERA5",
    ) -> None:
        """Record or expand the ingested temporal coverage bounds and metadata version."""
        ...

    async def get_dataset_version(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> str:
        """Return dataset revision token for safe cache keying and invalidation."""
        ...
