"""Application service for historical meteorological data ingestion and caching."""

import logging
from datetime import UTC, date, datetime, timedelta

from app.core.config import Settings, get_settings
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
        settings: Settings | None = None,
    ) -> None:
        self._repo = weather_repo
        self._provider = weather_provider
        self._coverage_repo = coverage_repo
        self._settings = settings or get_settings()

    async def ensure_historical_observations(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        """Ensure observations are available for the requested span.

        Exact missing-calendar-date detection:
        - Retrieves existing observations from MongoDB for the location and model.
        - Distinguishes stored missing temperatures from dates that were never fetched.
        - Clamps the fetch ceiling by data_lag_buffer_days from today to avoid ingesting
          future or unfinalized dates.
        - Groups missing dates into contiguous spans and fetches only those ranges.
        - Persists new observations idempotently without fabricating future missing dates.
        """
        # 1. Determine maximum ingestible date based on current time and publication lag
        today = datetime.now(UTC).date()
        max_ingestible_date = today - timedelta(days=self._settings.data_lag_buffer_days)
        clamped_end_date = min(end_date, max_ingestible_date)

        # 2. Check local persistent storage for this model
        existing_obs = await self._repo.get_observations(
            location, start_date, end_date, model=model
        )
        stored_by_date = {obs.date: obs for obs in existing_obs}

        # 3. Detect exact missing calendar dates up to clamped_end_date
        missing_dates: list[date] = []
        if clamped_end_date >= start_date:
            curr = start_date
            while curr <= clamped_end_date:
                if curr not in stored_by_date:
                    missing_dates.append(curr)
                curr += timedelta(days=1)

        # 4. Ingest missing dates grouped into contiguous spans
        if missing_dates:
            ranges: list[tuple[date, date]] = []
            range_start = missing_dates[0]
            prev = missing_dates[0]
            for d in missing_dates[1:]:
                if d == prev + timedelta(days=1):
                    prev = d
                else:
                    ranges.append((range_start, prev))
                    range_start = d
                    prev = d
            ranges.append((range_start, prev))

            logger.info(
                "Ingesting %d missing dates across %d range(s) for %s (%s) from Open-Meteo",
                len(missing_dates),
                len(ranges),
                location.coordinate_key,
                model,
            )

            for r_start, r_end in ranges:
                remote_obs = await self._provider.fetch_historical_daily(
                    location=location,
                    start_date=r_start,
                    end_date=r_end,
                    model=model,
                )
                if remote_obs:
                    await self._repo.upsert_observations(location, remote_obs)
                    for obs in remote_obs:
                        stored_by_date[obs.date] = obs

            # 5. Record coverage bounds if repository provided
            if self._coverage_repo is not None:
                await self._coverage_repo.record_coverage(
                    location=location,
                    start_date=start_date,
                    end_date=clamped_end_date,
                    record_count=len(stored_by_date),
                    model=model,
                )

        # 6. Return sorted observations for the requested span
        sorted_dates = sorted(stored_by_date.keys())
        return [stored_by_date[d] for d in sorted_dates if start_date <= d <= end_date]

    async def get_dataset_version(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> str:
        """Retrieve dataset revision token for cache key generation."""
        if self._coverage_repo is not None:
            return await self._coverage_repo.get_dataset_version(location, model=model)
        return "rev1_unindexed"
