"""Versioned API v1 Router aggregator."""

from fastapi import APIRouter

from app.api.v1.endpoints.analysis import router as analysis_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.regions import router as regions_router

api_v1_router = APIRouter(prefix="/api/v1")

# Mount endpoints
api_v1_router.include_router(health_router)
api_v1_router.include_router(regions_router)
api_v1_router.include_router(analysis_router)
