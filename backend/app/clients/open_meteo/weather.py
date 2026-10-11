"""Open-Meteo Historical Weather API adapter."""

import asyncio
import logging
import random
from datetime import date, datetime, timedelta
from typing import Any

import httpx
from pydantic import ValidationError

from app.clients.http_client import http_client_manager
from app.clients.open_meteo.exceptions import (
    OpenMeteoClientError,
    OpenMeteoMalformedPayloadError,
    OpenMeteoRateLimitError,
    OpenMeteoUpstreamError,
)
from app.clients.open_meteo.schemas import OpenMeteoHistoricalResponse
from app.core.config import get_settings
from app.domain.contracts import HistoricalWeatherProviderProtocol
from app.domain.models import DailyWeatherObservation, DataQualityStats, GeoLocation

logger = logging.getLogger(__name__)

SUPPORTED_REANALYSIS_MODELS = {
    "ERA5": "era5",
    "ERA5_LAND": "era5_land",
}


class OpenMeteoHistoricalWeatherClient(HistoricalWeatherProviderProtocol):
    """Adapter for the official Open-Meteo Historical Weather API.

    Features resilient retries, bounded backoff, upstream schema validation,
    calendar date normalization, and quality statistics generation.
    """

    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        base_url: str | None = None,
        max_retries: int | None = None,
        backoff_factor: float | None = None,
    ) -> None:
        settings = get_settings()
        self._client = client
        self._base_url = base_url or settings.open_meteo_historical_api_url
        self._max_retries = max_retries if max_retries is not None else settings.http_max_retries
        self._backoff_factor = (
            backoff_factor if backoff_factor is not None else settings.http_backoff_factor
        )

    def _get_http_client(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        return http_client_manager.get_client()

    async def fetch_historical_daily(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> list[DailyWeatherObservation]:
        """Fetch and normalize daily observations for a given location and date span."""
        observations, _ = await self.fetch_historical_with_quality(
            location=location,
            start_date=start_date,
            end_date=end_date,
            model=model,
        )
        return observations

    async def fetch_historical_with_quality(
        self,
        location: GeoLocation,
        start_date: date,
        end_date: date,
        model: str = "ERA5",
    ) -> tuple[list[DailyWeatherObservation], DataQualityStats]:
        """Fetch observations and calculate data completeness quality statistics."""
        if start_date > end_date:
            raise ValueError(f"start_date ({start_date}) cannot follow end_date ({end_date})")

        model_key = model.upper()
        if model_key not in SUPPORTED_REANALYSIS_MODELS:
            raise ValueError(
                f"Unsupported reanalysis model '{model}'. "
                f"Must be one of: {list(SUPPORTED_REANALYSIS_MODELS.keys())}"
            )

        api_model_param = SUPPORTED_REANALYSIS_MODELS[model_key]

        params: dict[str, Any] = {
            "latitude": round(location.latitude, 4),
            "longitude": round(location.longitude, 4),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily": "temperature_2m_max",
            "temperature_unit": "celsius",
            "timezone": "UTC",
            "models": api_model_param,
        }

        raw_payload = await self._execute_request(params)
        validated_response = self._validate_payload(raw_payload)

        return self._normalize_observations(
            validated_response=validated_response,
            start_date=start_date,
            end_date=end_date,
            source_model=model_key,
        )

    async def _execute_request(self, params: dict[str, Any]) -> dict[str, Any]:
        """Execute request with retries, exponential backoff, and rate-limit handling."""
        client = self._get_http_client()
        attempt = 0

        while True:
            attempt += 1
            try:
                response = await client.get(self._base_url, params=params)

                # Successful response
                if response.status_code == 200:
                    return response.json()

                # Handle 429 Rate Limiting
                if response.status_code == 429:
                    retry_after_header = response.headers.get("Retry-After")
                    retry_after = self._parse_retry_after(retry_after_header)

                    if attempt <= self._max_retries:
                        sleep_time = retry_after or (self._backoff_factor * (2 ** (attempt - 1)))
                        sleep_time = min(sleep_time + random.uniform(0.1, 0.5), 60.0)
                        logger.warning(
                            f"Open-Meteo rate limit (429) hit. Backing off for {sleep_time:.2f}s "
                            f"(attempt {attempt}/{self._max_retries})"
                        )
                        await asyncio.sleep(sleep_time)
                        continue

                    raise OpenMeteoRateLimitError(
                        "Open-Meteo rate limit exceeded. Please retry later.",
                        retry_after=retry_after,
                    )

                # Non-retriable client errors (400, 404, etc.)
                if 400 <= response.status_code < 500:
                    sanitized_reason = (
                        response.text[:120].strip() if response.text else "Client Error"
                    )
                    logger.error(
                        f"Open-Meteo returned client error {response.status_code}: "
                        f"{sanitized_reason}"
                    )
                    raise OpenMeteoClientError(
                        f"Upstream rejected request with status {response.status_code}",
                        status_code=response.status_code,
                    )

                # Upstream server errors (500, 502, 503, 504)
                if response.status_code in {500, 502, 503, 504}:
                    if attempt <= self._max_retries:
                        sleep_time = min(
                            self._backoff_factor * (2 ** (attempt - 1)) + random.uniform(0.1, 0.4),
                            30.0,
                        )
                        logger.warning(
                            f"Open-Meteo returned status {response.status_code}. "
                            f"Retrying in {sleep_time:.2f}s (attempt {attempt}/{self._max_retries})"
                        )
                        await asyncio.sleep(sleep_time)
                        continue

                    raise OpenMeteoUpstreamError(
                        f"Open-Meteo upstream service unavailable (status {response.status_code})",
                        status_code=response.status_code,
                    )

                # Unhandled other status codes
                raise OpenMeteoUpstreamError(
                    f"Unexpected status code {response.status_code} from Open-Meteo",
                    status_code=response.status_code,
                )

            except httpx.TransportError as exc:
                if attempt <= self._max_retries:
                    sleep_time = min(
                        self._backoff_factor * (2 ** (attempt - 1)) + random.uniform(0.1, 0.4),
                        30.0,
                    )
                    logger.warning(
                        f"Network transport error connecting to Open-Meteo: {type(exc).__name__}. "
                        f"Retrying in {sleep_time:.2f}s (attempt {attempt}/{self._max_retries})"
                    )
                    await asyncio.sleep(sleep_time)
                    continue

                logger.error(
                    f"Network connection to Open-Meteo failed after {attempt} attempts: "
                    f"{type(exc).__name__}"
                )
                raise OpenMeteoUpstreamError(
                    "Failed to communicate with Open-Meteo weather service."
                ) from exc

    def _validate_payload(self, raw_data: dict[str, Any]) -> OpenMeteoHistoricalResponse:
        """Validate raw response schema using Pydantic."""
        try:
            return OpenMeteoHistoricalResponse.model_validate(raw_data)
        except ValidationError as exc:
            logger.error("Open-Meteo response structure validation failed.")
            raise OpenMeteoMalformedPayloadError(
                "Upstream historical weather response failed validation."
            ) from exc

    def _normalize_observations(
        self,
        validated_response: OpenMeteoHistoricalResponse,
        start_date: date,
        end_date: date,
        source_model: str,
    ) -> tuple[list[DailyWeatherObservation], DataQualityStats]:
        """Align upstream response into a complete calendar timeseries."""
        daily = validated_response.daily

        if len(daily.time) != len(daily.temperature_2m_max):
            raise OpenMeteoMalformedPayloadError(
                f"Mismatched array lengths: {len(daily.time)} timestamps vs "
                f"{len(daily.temperature_2m_max)} temperature values."
            )

        # Parse and index upstream values by date
        upstream_records: dict[date, float | None] = {}
        for time_str, temp_val in zip(daily.time, daily.temperature_2m_max, strict=True):
            try:
                obs_date = datetime.strptime(time_str, "%Y-%m-%d").date()
            except ValueError as exc:
                raise OpenMeteoMalformedPayloadError(
                    f"Malformed date string in response: '{time_str}'"
                ) from exc

            if obs_date in upstream_records:
                raise OpenMeteoMalformedPayloadError(
                    f"Duplicate date '{obs_date}' in upstream response."
                )

            # Round valid float or preserve None
            if temp_val is not None:
                upstream_records[obs_date] = round(float(temp_val), 2)
            else:
                upstream_records[obs_date] = None

        # Build contiguous date span
        observations: list[DailyWeatherObservation] = []
        current = start_date
        total_expected_days = 0
        observed_days = 0
        longest_missing_streak = 0
        current_missing_streak = 0

        while current <= end_date:
            total_expected_days += 1
            temp = upstream_records.get(current)

            if temp is not None:
                observed_days += 1
                current_missing_streak = 0
            else:
                current_missing_streak += 1
                if current_missing_streak > longest_missing_streak:
                    longest_missing_streak = current_missing_streak

            observations.append(
                DailyWeatherObservation(
                    date=current,
                    temp_max=temp,
                    unit="°C",
                    source_model=source_model,
                )
            )
            current += timedelta(days=1)

        missing_days = total_expected_days - observed_days
        completeness_ratio = observed_days / total_expected_days if total_expected_days > 0 else 0.0
        has_critical_gaps = (completeness_ratio < 0.90) or (longest_missing_streak > 15)

        stats = DataQualityStats(
            total_expected_days=total_expected_days,
            observed_days=observed_days,
            missing_days=missing_days,
            completeness_ratio=round(completeness_ratio, 4),
            has_critical_gaps=has_critical_gaps,
            longest_missing_streak_days=longest_missing_streak,
        )

        return observations, stats

    @staticmethod
    def _parse_retry_after(header_val: str | None) -> float | None:
        """Parse Retry-After header into seconds if available."""
        if not header_val:
            return None
        try:
            return float(header_val.strip())
        except ValueError:
            return None
