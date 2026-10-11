"""FastAPI dependency injection providers."""

from typing import Any

import httpx
from fastapi import Depends
from pymongo.asynchronous.database import AsyncDatabase
from redis.asyncio import Redis

from app.cache.redis import redis_manager
from app.cache.service import RedisAnalysisCache
from app.clients.http_client import http_client_manager
from app.clients.open_meteo import (
    OpenMeteoGeocodingClient,
    OpenMeteoHistoricalWeatherClient,
)
from app.core.config import Settings, get_settings
from app.db.mongo import mongo_manager
from app.db.repositories import MongoCoverageRepository, MongoWeatherRepository
from app.domain.contracts import (
    AnalysisCacheProtocol,
    CoverageMetadataRepositoryProtocol,
    GeocodingProviderProtocol,
    HistoricalWeatherProviderProtocol,
    WeatherRepositoryProtocol,
)
from app.services.analysis_service import AnalysisService
from app.services.region_service import RegionService
from app.services.weather_service import WeatherService


def get_current_settings() -> Settings:
    """Provide application settings."""
    return get_settings()


def get_mongo_db() -> AsyncDatabase[dict[str, Any]]:
    """Provide the active AsyncDatabase instance."""
    return mongo_manager.get_database()


def get_redis() -> Redis | None:
    """Provide active Redis client, or None if uninitialized (enabling degraded mode)."""
    if not redis_manager.is_connected:
        return None
    return redis_manager.client


def get_http_client() -> httpx.AsyncClient:
    """Provide the active HTTPX AsyncClient."""
    return http_client_manager.get_client()


def get_weather_repository(
    db: AsyncDatabase[dict[str, Any]] = Depends(get_mongo_db),
) -> WeatherRepositoryProtocol:
    """Provide MongoDB weather repository."""
    return MongoWeatherRepository(database=db)


def get_coverage_repository(
    db: AsyncDatabase[dict[str, Any]] = Depends(get_mongo_db),
) -> CoverageMetadataRepositoryProtocol:
    """Provide MongoDB coverage metadata repository."""
    return MongoCoverageRepository(database=db)


def get_weather_provider(
    client: httpx.AsyncClient = Depends(get_http_client),
) -> HistoricalWeatherProviderProtocol:
    """Provide Open-Meteo Historical Weather provider."""
    return OpenMeteoHistoricalWeatherClient(client=client)


def get_geocoding_provider(
    client: httpx.AsyncClient = Depends(get_http_client),
) -> GeocodingProviderProtocol:
    """Provide Open-Meteo Geocoding provider."""
    return OpenMeteoGeocodingClient(client=client)


def get_analysis_cache(
    redis_client: Redis | None = Depends(get_redis),
    settings: Settings = Depends(get_current_settings),
) -> AnalysisCacheProtocol:
    """Provide Redis analysis cache with configurable TTL and degraded mode."""
    return RedisAnalysisCache(
        redis_client=redis_client,
        default_ttl_seconds=settings.cache_ttl_seconds,
    )


def get_region_service(
    provider: GeocodingProviderProtocol = Depends(get_geocoding_provider),
) -> RegionService:
    """Provide RegionService instance."""
    return RegionService(geocoding_provider=provider)


def get_weather_service(
    repo: WeatherRepositoryProtocol = Depends(get_weather_repository),
    provider: HistoricalWeatherProviderProtocol = Depends(get_weather_provider),
    coverage_repo: CoverageMetadataRepositoryProtocol = Depends(get_coverage_repository),
) -> WeatherService:
    """Provide WeatherService instance."""
    return WeatherService(
        weather_repo=repo,
        weather_provider=provider,
        coverage_repo=coverage_repo,
    )


def get_analysis_service(
    weather_service: WeatherService = Depends(get_weather_service),
    cache: AnalysisCacheProtocol = Depends(get_analysis_cache),
    settings: Settings = Depends(get_current_settings),
) -> AnalysisService:
    """Provide AnalysisService instance."""
    return AnalysisService(
        weather_service=weather_service,
        cache=cache,
        settings=settings,
    )
