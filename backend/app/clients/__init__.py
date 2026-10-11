"""Client integrations package."""

from app.clients.http_client import HTTPClientManager, http_client_manager
from app.clients.open_meteo import (
    OpenMeteoGeocodingClient,
    OpenMeteoHistoricalWeatherClient,
)

__all__ = [
    "HTTPClientManager",
    "http_client_manager",
    "OpenMeteoHistoricalWeatherClient",
    "OpenMeteoGeocodingClient",
]
