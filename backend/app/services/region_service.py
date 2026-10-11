"""Application service for region search and geocoding."""

import logging

from app.clients.open_meteo.exceptions import OpenMeteoError
from app.domain.contracts import GeocodingProviderProtocol
from app.schemas.responses import GeoLocationDTO

logger = logging.getLogger(__name__)


class RegionService:
    """Orchestrates location resolution and coordinate lookup."""

    def __init__(self, geocoding_provider: GeocodingProviderProtocol) -> None:
        self._provider = geocoding_provider

    async def search_regions(self, query: str, limit: int = 5) -> list[GeoLocationDTO]:
        """Search regions and return normalized geographic DTOs."""
        clean_query = query.strip()
        if not clean_query:
            return []

        try:
            domain_locations = await self._provider.search_locations(clean_query, limit=limit)
        except OpenMeteoError as exc:
            logger.error(
                "Geocoding provider error during search for '%s': %s", clean_query, exc.message
            )
            raise

        return [
            GeoLocationDTO(
                latitude=loc.latitude,
                longitude=loc.longitude,
                name=loc.name,
                country=loc.country,
                country_code=loc.country_code,
                admin1=loc.admin1,
                elevation=loc.elevation,
                timezone=loc.timezone,
            )
            for loc in domain_locations
        ]
