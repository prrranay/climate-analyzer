"""Health check endpoints (Liveness and Readiness)."""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.cache.redis import redis_manager
from app.core.config import get_settings
from app.db.mongo import mongo_manager

router = APIRouter(prefix="/health", tags=["Health"])


class LivenessResponse(BaseModel):
    """Liveness probe response schema."""

    status: Literal["alive"] = "alive"
    timestamp: str = Field(..., description="UTC ISO-8601 timestamp")
    app: str = Field(..., description="Application name")
    environment: str = Field(..., description="Current environment")


class ComponentStatus(BaseModel):
    """Component health status schema."""

    mongodb: Literal["connected", "disconnected"]
    redis: Literal["connected", "disconnected"]


class ReadinessResponse(BaseModel):
    """Readiness probe response schema."""

    status: Literal["ready", "not_ready"]
    timestamp: str
    components: ComponentStatus


@router.get(
    "/live",
    response_model=LivenessResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness Probe",
    description="Indicates if the application server is up. Independent of external dependencies.",
)
async def check_liveness() -> LivenessResponse:
    """Return application liveness status without contacting external services."""
    settings = get_settings()
    return LivenessResponse(
        status="alive",
        timestamp=datetime.now(UTC).isoformat(),
        app=settings.app_name,
        environment=settings.environment,
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={
        200: {"description": "All required infrastructure services are reachable."},
        503: {"description": "One or more infrastructure services are unavailable."},
    },
    summary="Readiness Probe",
    description="Verifies operational readiness by validating connections to MongoDB and Redis.",
)
async def check_readiness() -> JSONResponse:
    """Verify application readiness by probing database and cache connections."""
    mongo_ok = await mongo_manager.ping()
    redis_ok = await redis_manager.ping()

    components = ComponentStatus(
        mongodb="connected" if mongo_ok else "disconnected",
        redis="connected" if redis_ok else "disconnected",
    )

    all_ready = mongo_ok and redis_ok
    status_code = status.HTTP_200_OK if all_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = ReadinessResponse(
        status="ready" if all_ready else "not_ready",
        timestamp=datetime.now(UTC).isoformat(),
        components=components,
    )

    return JSONResponse(status_code=status_code, content=payload.model_dump())
