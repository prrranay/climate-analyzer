"""Application service for historical meteorological data ingestion and caching."""

import logging
from datetime import date, timedelta

from app.domain.contracts import (
    CoverageMetadataRepositoryProtocol,
    HistoricalWeatherProviderProtocol,
    WeatherRepositoryProtocol,
)
from app.domain.models import DailyWeatherObservation, GeoLocation

logger = logging.getLogger(__name__)


class WeatherService:
    """Orchestrates historical weather observation retrieval and local persistence."""

    def __init__(
        self,
        weather_repo: WeatherRepositoryProtocol,
        weather_provider: HistoricalWeatherProviderProtocol,
        coverage_repo: CoverageMetadataRepositoryProtocol | None = None,
    ) -> None:
        self._repo = weather_repo
        self._provider = weather_provider
        self._coverage_repo = coverage_repo

    async def ensure_historical_observations(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        """Ensure observations are available for the entire requested span.

        Checks MongoDB repository first. If all required calendar observations
        exist, reuses them without contacting the remote API. If missing or
        partially incomplete, fetches only the absent date span from Open-Meteo
        and persists them idempotently.
        """
        expected_days = (end_date - start_date).days + 1

        # 1. Check local persistent storage
        existing_obs = await self._repo.get_observations(location, start_date, end_date)

        if len(existing_obs) == expected_days:
            logger.debug(
                "Cache hit: Reusing %d observations from MongoDB for %s (%s to %s)",
                len(existing_obs),
                location.coordinate_key,
                start_date,
                end_date,
            )
            return existing_obs

        # 2. Determine exact missing date segment to avoid re-fetching already stored days
        fetch_start = start_date
        fetch_end = end_date

        if existing_obs:
            first_stored = existing_obs[0].date
            last_stored = existing_obs[-1].date
            if first_stored == start_date and last_stored < end_date:
                # Contiguous prefix present: only fetch missing suffix
                fetch_start = last_stored + timedelta(days=1)
                logger.info(
                    "Reusing %d observations; fetching missing %s to %s from Open-Meteo",
                    len(existing_obs),
                    fetch_start,
                    fetch_end,
                )
            elif first_stored > start_date and last_stored == end_date:
                # Contiguous suffix present: only fetch missing prefix
                fetch_end = first_stored - timedelta(days=1)
                logger.info(
                    "Reusing %d observations; fetching missing %s to %s from Open-Meteo",
                    len(existing_obs),
                    fetch_start,
                    fetch_end,
                )

        # 3. Ingest missing observations from remote reanalysis provider
        remote_obs = await self._provider.fetch_historical_daily(
            location=location,
            start_date=fetch_start,
            end_date=fetch_end,
            model=model,
        )

        # 4. Persist to MongoDB
        await self._repo.upsert_observations(location, remote_obs)

        # 5. Record coverage bounds if repository provided
        if self._coverage_repo is not None:
            await self._coverage_repo.record_coverage(
                location=location,
                start_date=start_date,
                end_date=end_date,
                record_count=len(existing_obs) + len(remote_obs),
                model=model,
            )

        # 6. Return full sorted daily observation series
        if not existing_obs:
            return remote_obs

        combined = {obs.date: obs for obs in existing_obs}
        for obs in remote_obs:
            combined[obs.date] = obs
        return [combined[d] for d in sorted(combined.keys()) if start_date <= d <= end_date]

    async def get_dataset_version(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> str:
        """Retrieve dataset revision token for cache key generation."""
        if self._coverage_repo is not None:
            return await self._coverage_repo.get_dataset_version(location, model=model)
        return "rev1_unindexed"
