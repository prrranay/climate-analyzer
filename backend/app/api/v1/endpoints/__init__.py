"""API v1 endpoints package."""

from app.api.v1.endpoints.analysis import router as analysis_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.regions import router as regions_router

__all__ = ["health_router", "regions_router", "analysis_router"]
