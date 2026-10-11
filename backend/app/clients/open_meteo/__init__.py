"""Open-Meteo client integration package."""

from app.clients.open_meteo.exceptions import (
    OpenMeteoClientError,
    OpenMeteoError,
    OpenMeteoMalformedPayloadError,
    OpenMeteoRateLimitError,
    OpenMeteoUpstreamError,
)
from app.clients.open_meteo.geocoding import OpenMeteoGeocodingClient
from app.clients.open_meteo.weather import (
    SUPPORTED_REANALYSIS_MODELS,
    OpenMeteoHistoricalWeatherClient,
)

__all__ = [
    "OpenMeteoError",
    "OpenMeteoClientError",
    "OpenMeteoRateLimitError",
    "OpenMeteoUpstreamError",
    "OpenMeteoMalformedPayloadError",
    "OpenMeteoHistoricalWeatherClient",
    "OpenMeteoGeocodingClient",
    "SUPPORTED_REANALYSIS_MODELS",
]
