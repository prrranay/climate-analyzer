"""Climate hazard analysis API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_analysis_service
from app.cache.rate_limiter import RateLimiterDependency
from app.clients.open_meteo.exceptions import (
    OpenMeteoClientError,
    OpenMeteoRateLimitError,
    OpenMeteoUpstreamError,
)
from app.schemas.errors import ErrorResponse
from app.schemas.requests import BoundingBoxAnalysisQuery, HeatwaveAnalysisQuery
from app.schemas.responses import (
    BoundingBoxHeatwaveAnalysisResponse,
    HeatwaveAnalysisResponse,
)
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analysis", tags=["Analysis"])


@router.get(
    "/heatwave",
    response_model=HeatwaveAnalysisResponse,
    responses={
        200: {"description": "Heatwave hazard analysis completed successfully."},
        400: {"model": ErrorResponse, "description": "Invalid query parameters."},
        422: {"model": ErrorResponse, "description": "Validation constraint failure."},
        429: {"model": ErrorResponse, "description": "Upstream rate limit exceeded."},
        502: {"model": ErrorResponse, "description": "Upstream weather provider failure."},
    },
    summary="Analyze Heatwaves and Trends",
    description=(
        "Ingests historical meteorological data, derives a moving-window 95th-percentile "
        "threshold from the reference baseline, detects heatwaves, and computes annual "
        "frequency, duration, intensity, and statistical trends."
    ),
)
async def get_heatwave_analysis(
    query: Annotated[HeatwaveAnalysisQuery, Query()],
    service: AnalysisService = Depends(get_analysis_service),
    _rate_limit: None = Depends(RateLimiterDependency(scope="heatwave_analysis")),
) -> HeatwaveAnalysisResponse:
    """Execute heatwave hazard analysis for the specified location and time period."""
    try:
        return await service.analyze_heatwaves(query=query)
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
            detail="Upstream weather provider is temporarily unavailable.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/heatwave/bbox",
    response_model=BoundingBoxHeatwaveAnalysisResponse,
    responses={
        200: {"description": "Bounding box heatwave hazard analysis completed successfully."},
        400: {"model": ErrorResponse, "description": "Invalid bounding box query parameters."},
        422: {"model": ErrorResponse, "description": "Validation constraint failure."},
        429: {"model": ErrorResponse, "description": "Upstream rate limit exceeded."},
        502: {"model": ErrorResponse, "description": "Upstream weather provider failure."},
    },
    summary="Analyze Heatwaves and Trends for Bounding Box",
    description=(
        "Performs regional heatwave hazard analysis over a geographic bounding box. "
        "Samples a deterministic regular spatial grid (<= 9 points), retrieves daily observations, "
        "computes a daily regional spatial mean with completeness screening, and derives long-term "
        "heatwave hazard trends."
    ),
)
async def get_bounding_box_heatwave_analysis(
    query: Annotated[BoundingBoxAnalysisQuery, Query()],
    service: AnalysisService = Depends(get_analysis_service),
    _rate_limit: None = Depends(RateLimiterDependency(scope="heatwave_bbox_analysis")),
) -> BoundingBoxHeatwaveAnalysisResponse:
    """Execute regional bounding-box heatwave hazard analysis."""
    try:
        return await service.analyze_bounding_box_heatwaves(query=query)
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
            detail="Upstream weather provider is temporarily unavailable.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
