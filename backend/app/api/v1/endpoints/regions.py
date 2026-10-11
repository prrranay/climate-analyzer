"""Regions and geocoding search API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_region_service
from app.cache.rate_limiter import RateLimiterDependency
from app.clients.open_meteo.exceptions import (
    OpenMeteoClientError,
    OpenMeteoRateLimitError,
    OpenMeteoUpstreamError,
)
from app.schemas.errors import ErrorResponse
from app.schemas.responses import GeoLocationDTO
from app.services.region_service import RegionService

router = APIRouter(prefix="/regions", tags=["Regions"])


@router.get(
    "/search",
    response_model=list[GeoLocationDTO],
    responses={
        200: {"description": "Matching geographic locations found."},
        400: {"model": ErrorResponse, "description": "Invalid query parameters."},
        429: {"model": ErrorResponse, "description": "Upstream rate limit exceeded."},
        502: {"model": ErrorResponse, "description": "Upstream geocoding service failure."},
    },
    summary="Search Regions",
    description="Search for locations and coordinates using the Open-Meteo Geocoding API.",
)
async def search_regions(
    q: str = Query(
        ...,
        alias="q",
        min_length=2,
        max_length=100,
        description="Search query for a city or region name",
        examples=["Hyderabad"],
    ),
    count: int = Query(
        default=5,
        alias="count",
        ge=1,
        le=20,
        description="Maximum candidates to return",
        examples=[10],
    ),
    service: RegionService = Depends(get_region_service),
    _rate_limit: None = Depends(RateLimiterDependency(scope="regions_search")),
) -> list[GeoLocationDTO]:
    """Execute geocoding search for location candidates."""
    try:
        return await service.search_regions(query=q, limit=count)
    except OpenMeteoRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=exc.message,
        ) from exc
    except OpenMeteoClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc
    except OpenMeteoUpstreamError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upstream geocoding service is temporarily unavailable.",
        ) from exc
