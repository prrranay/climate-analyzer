"""MongoDB repositories for weather observations, baseline thresholds, and coverage metadata."""

import logging
from datetime import UTC, date, datetime
from typing import Any

from pymongo import UpdateOne
from pymongo.asynchronous.database import AsyncDatabase

from app.domain.contracts import (
    CoverageMetadataRepositoryProtocol,
    WeatherRepositoryProtocol,
)
from app.domain.models import BaselineConfig, DailyWeatherObservation, GeoLocation

logger = logging.getLogger(__name__)


class MongoWeatherRepository(WeatherRepositoryProtocol):
    """MongoDB implementation of WeatherRepositoryProtocol."""

    def __init__(self, database: AsyncDatabase[dict[str, Any]]) -> None:
        self._db = database
        self._observations = database["weather_observations"]
        self._thresholds = database["baseline_thresholds"]

    async def ensure_indexes(self) -> None:
        """Create unique compound indexes if not already present."""
        try:
            await self._observations.create_index(
                [("location_key", 1), ("date", 1)],
                unique=True,
                background=True,
            )
            await self._thresholds.create_index(
                [
                    ("location_key", 1),
                    ("baseline_start", 1),
                    ("baseline_end", 1),
                    ("percentile", 1),
                ],
                unique=True,
                background=True,
            )
        except Exception as exc:
            logger.warning(f"Failed to create indexes in MongoWeatherRepository: {exc}")

    async def upsert_observations(
        self,
        location: GeoLocation,
        observations: list[DailyWeatherObservation],
    ) -> int:
        """Upsert daily weather observations idempotently using bulk write."""
        if not observations:
            return 0

        loc_key = location.coordinate_key
        now_iso = datetime.now(UTC).isoformat()
        operations: list[UpdateOne] = []

        for obs in observations:
            doc = {
                "location_key": loc_key,
                "date": obs.date.isoformat(),
                "temp_max": obs.temp_max,
                "unit": obs.unit,
                "source_model": obs.source_model,
                "updated_at": now_iso,
            }
            operations.append(
                UpdateOne(
                    {"location_key": loc_key, "date": obs.date.isoformat()},
                    {"$set": doc},
                    upsert=True,
                )
            )

        result = await self._observations.bulk_write(operations, ordered=False)
        return result.upserted_count + result.modified_count

    async def get_observations(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
    ) -> list[DailyWeatherObservation]:
        """Retrieve daily observations within an inclusive date range."""
        loc_key = location.coordinate_key
        query = {
            "location_key": loc_key,
            "date": {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat(),
            },
        }

        cursor = self._observations.find(query).sort("date", 1)
        documents = await cursor.to_list(length=None)

        results: list[DailyWeatherObservation] = []
        for doc in documents:
            obs_date = date.fromisoformat(doc["date"])
            results.append(
                DailyWeatherObservation(
                    date=obs_date,
                    temp_max=doc.get("temp_max"),
                    unit=doc.get("unit", "°C"),
                    source_model=doc.get("source_model", "ERA5"),
                )
            )

        return results

    async def get_cached_threshold(
        self,
        location: GeoLocation,
        baseline: BaselineConfig,
    ) -> float | None:
        """Retrieve precomputed baseline threshold."""
        doc = await self._thresholds.find_one(
            {
                "location_key": location.coordinate_key,
                "baseline_start": baseline.baseline_start_year,
                "baseline_end": baseline.baseline_end_year,
                "percentile": baseline.percentile_threshold,
            }
        )
        if doc and "threshold_celsius" in doc:
            return float(doc["threshold_celsius"])
        return None

    async def save_cached_threshold(
        self,
        location: GeoLocation,
        baseline: BaselineConfig,
        threshold_celsius: float,
    ) -> None:
        """Persist precomputed baseline threshold."""
        await self._thresholds.update_one(
            {
                "location_key": location.coordinate_key,
                "baseline_start": baseline.baseline_start_year,
                "baseline_end": baseline.baseline_end_year,
                "percentile": baseline.percentile_threshold,
            },
            {
                "$set": {
                    "threshold_celsius": threshold_celsius,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            },
            upsert=True,
        )


class MongoCoverageRepository(CoverageMetadataRepositoryProtocol):
    """MongoDB implementation of CoverageMetadataRepositoryProtocol."""

    def __init__(self, database: AsyncDatabase[dict[str, Any]]) -> None:
        self._collection = database["coverage_metadata"]

    async def ensure_indexes(self) -> None:
        """Create unique compound index on location_key and model."""
        try:
            await self._collection.create_index(
                [("location_key", 1), ("model", 1)],
                unique=True,
                background=True,
            )
        except Exception as exc:
            logger.warning("Failed to create indexes in MongoCoverageRepository: %s", exc)

    async def get_coverage(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> tuple[date, date] | None:
        """Return contiguous ingested date bounds (min_date, max_date)."""
        doc = await self._collection.find_one(
            {"location_key": location.coordinate_key, "model": model}
        )
        if doc and "start_date" in doc and "end_date" in doc:
            return date.fromisoformat(doc["start_date"]), date.fromisoformat(doc["end_date"])
        return None

    async def record_coverage(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        record_count: int,
        schema_version: str = "v1",
        model: str = "ERA5",
    ) -> None:
        """Update ingested temporal coverage bounds."""
        existing = await self.get_coverage(location, model=model)
        new_start = min(start_date, existing[0]) if existing else start_date
        new_end = max(end_date, existing[1]) if existing else end_date

        await self._collection.update_one(
            {"location_key": location.coordinate_key, "model": model},
            {
                "$set": {
                    "start_date": new_start.isoformat(),
                    "end_date": new_end.isoformat(),
                    "record_count": record_count,
                    "schema_version": schema_version,
                    "updated_at": datetime.now(UTC).isoformat(),
                },
                "$inc": {"revision": 1},
            },
            upsert=True,
        )

    async def get_dataset_version(
        self,
        location: GeoLocation,
        model: str = "ERA5",
    ) -> str:
        """Return dataset revision token for safe cache keying and invalidation."""
        doc = await self._collection.find_one(
            {"location_key": location.coordinate_key, "model": model}
        )
        if not doc:
            return "rev0_empty"
        rev = doc.get("revision", 1)
        start = doc.get("start_date", "")
        end = doc.get("end_date", "")
        count = doc.get("record_count", 0)
        return f"rev{rev}_{start}_{end}_{count}"
