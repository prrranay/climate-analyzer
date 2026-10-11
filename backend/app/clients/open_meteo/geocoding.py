"""Open-Meteo Geocoding API adapter."""

import asyncio
import logging
import random
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
from app.clients.open_meteo.schemas import OpenMeteoGeocodingResponse
from app.core.config import get_settings
from app.domain.contracts import GeocodingProviderProtocol
from app.domain.models import GeoLocation

logger = logging.getLogger(__name__)


class OpenMeteoGeocodingClient(GeocodingProviderProtocol):
    """Adapter for the official Open-Meteo Geocoding API.

    Resolves geographic queries to coordinates and administrative metadata.
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
        self._base_url = base_url or settings.open_meteo_geocoding_api_url
        self._max_retries = max_retries if max_retries is not None else settings.http_max_retries
        self._backoff_factor = (
            backoff_factor if backoff_factor is not None else settings.http_backoff_factor
        )

    def _get_http_client(self) -> httpx.AsyncClient:
        if self._client is not None:
            return self._client
        return http_client_manager.get_client()

    async def search_locations(
        self,
        query: str,
        limit: int = 5,
    ) -> list[GeoLocation]:
        """Search location candidates by name.

        Returns empty list if query is empty or no matches.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        capped_limit = min(max(limit, 1), 20)

        params: dict[str, Any] = {
            "name": clean_query,
            "count": capped_limit,
            "language": "en",
            "format": "json",
        }

        raw_payload = await self._execute_request(params)
        validated_response = self._validate_payload(raw_payload)

        locations: list[GeoLocation] = []
        for item in validated_response.results:
            try:
                loc = GeoLocation(
                    latitude=round(item.latitude, 4),
                    longitude=round(item.longitude, 4),
                    name=item.name,
                    country=item.country,
                    country_code=item.country_code,
                    admin1=item.admin1,
                    elevation=item.elevation,
                    timezone=item.timezone or "UTC",
                )
                locations.append(loc)
            except ValueError as exc:
                logger.warning(f"Skipping geocoding candidate with invalid coordinates: {exc}")
                continue

        return locations

    async def _execute_request(self, params: dict[str, Any]) -> dict[str, Any]:
        """Execute geocoding request with retry and backoff policy."""
        client = self._get_http_client()
        attempt = 0

        while True:
            attempt += 1
            try:
                response = await client.get(self._base_url, params=params)

                if response.status_code == 200:
                    return response.json()

                if response.status_code == 429:
                    retry_after = self._parse_retry_after(response.headers.get("Retry-After"))
                    if attempt <= self._max_retries:
                        sleep_time = retry_after or (self._backoff_factor * (2 ** (attempt - 1)))
                        sleep_time = min(sleep_time + random.uniform(0.1, 0.4), 60.0)
                        logger.warning(
                            f"Open-Meteo Geocoding rate limit (429). Retrying in {sleep_time:.2f}s "
                            f"(attempt {attempt}/{self._max_retries})"
                        )
                        await asyncio.sleep(sleep_time)
                        continue

                    raise OpenMeteoRateLimitError(
                        "Open-Meteo geocoding rate limit exceeded.", retry_after=retry_after
                    )

                if 400 <= response.status_code < 500:
                    sanitized_reason = (
                        response.text[:120].strip() if response.text else "Client Error"
                    )
                    logger.error(
                        f"Open-Meteo Geocoding error {response.status_code}: {sanitized_reason}"
                    )
                    raise OpenMeteoClientError(
                        f"Geocoding request rejected with status {response.status_code}",
                        status_code=response.status_code,
                    )

                if response.status_code in {500, 502, 503, 504}:
                    if attempt <= self._max_retries:
                        sleep_time = min(
                            self._backoff_factor * (2 ** (attempt - 1)) + random.uniform(0.1, 0.4),
                            30.0,
                        )
                        logger.warning(
                            f"Open-Meteo Geocoding status {response.status_code}. "
                            f"Retrying in {sleep_time:.2f}s (attempt {attempt}/{self._max_retries})"
                        )
                        await asyncio.sleep(sleep_time)
                        continue

                    raise OpenMeteoUpstreamError(
                        f"Open-Meteo geocoding unavailable (status {response.status_code})",
                        status_code=response.status_code,
                    )

                raise OpenMeteoUpstreamError(
                    f"Unexpected status code {response.status_code} from Open-Meteo Geocoding",
                    status_code=response.status_code,
                )

            except httpx.TransportError as exc:
                if attempt <= self._max_retries:
                    sleep_time = min(
                        self._backoff_factor * (2 ** (attempt - 1)) + random.uniform(0.1, 0.4),
                        30.0,
                    )
                    logger.warning(
                        f"Network error during geocoding: {type(exc).__name__}. "
                        f"Retrying in {sleep_time:.2f}s (attempt {attempt}/{self._max_retries})"
                    )
                    await asyncio.sleep(sleep_time)
                    continue

                logger.error(
                    f"Geocoding connection failed after {attempt} attempts: {type(exc).__name__}"
                )
                raise OpenMeteoUpstreamError(
                    "Failed to communicate with Open-Meteo Geocoding API."
                ) from exc

    def _validate_payload(self, raw_data: dict[str, Any]) -> OpenMeteoGeocodingResponse:
        """Validate raw geocoding response."""
        try:
            return OpenMeteoGeocodingResponse.model_validate(raw_data)
        except ValidationError as exc:
            logger.error("Open-Meteo Geocoding response validation failed.")
            raise OpenMeteoMalformedPayloadError(
                "Upstream geocoding response failed validation."
            ) from exc

    @staticmethod
    def _parse_retry_after(header_val: str | None) -> float | None:
        if not header_val:
            return None
        try:
            return float(header_val.strip())
        except ValueError:
            return None
