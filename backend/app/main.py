"""FastAPI application entrypoint and factory."""

import logging
import time

from fastapi import FastAPI, Request, status
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import Settings, get_settings
from app.core.lifespan import lifespan
from app.core.logging import setup_logging
from app.schemas.errors import ErrorResponse

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application instance."""
    if settings is None:
        settings = get_settings()

    # Configure structured logging
    setup_logging(environment=settings.environment, debug=settings.debug)

    app = FastAPI(
        title=settings.app_name,
        description=(
            "Climate Hazard Trend Analyzer backend for ingesting Open-Meteo historical "
            "reanalysis data, detecting regional heatwaves, and computing hazard trends."
        ),
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
        openapi_url="/openapi.json" if settings.environment != "production" else None,
        lifespan=lifespan,
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request performance timing middleware
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = time.perf_counter() - start_time
        response.headers["X-Process-Time-Ms"] = f"{process_time * 1000:.2f}"
        return response

    # Validation error handler
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        details = [
            {
                "field": ".".join(str(loc) for loc in err["loc"] if loc != "query"),
                "issue": err["msg"],
            }
            for err in exc.errors()
        ]
        error_payload = ErrorResponse(
            error_code="VALIDATION_ERROR",
            message="Request validation failed. Please check the input parameters.",
            details=details,
            request_id=request.headers.get("X-Request-ID"),
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=error_payload.model_dump(),
        )

    # HTTP exception handler
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        code_mapping = {
            400: "BAD_REQUEST",
            404: "NOT_FOUND",
            422: "UNPROCESSABLE_ENTITY",
            429: "RATE_LIMIT_EXCEEDED",
            502: "UPSTREAM_SERVICE_ERROR",
            503: "SERVICE_UNAVAILABLE",
        }
        error_code = code_mapping.get(exc.status_code, "HTTP_ERROR")
        error_payload = ErrorResponse(
            error_code=error_code,
            message=str(exc.detail),
            request_id=request.headers.get("X-Request-ID"),
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload.model_dump(),
            headers=exc.headers,
        )

    # Global unhandled exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"Unhandled error processing {request.method} {request.url.path}: {exc}",
            exc_info=True,
        )
        error_payload = ErrorResponse(
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred.",
            request_id=request.headers.get("X-Request-ID"),
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_payload.model_dump(),
        )

    # Mount versioned API routes
    app.include_router(api_v1_router)

    # Root informational endpoint
    @app.get("/", tags=["Root"])
    async def root_info():
        return {
            "name": settings.app_name,
            "version": "0.1.0",
            "environment": settings.environment,
            "docs": "/docs" if settings.environment != "production" else "disabled in production",
            "health": {
                "live": "/api/v1/health/live",
                "ready": "/api/v1/health/ready",
            },
        }

    return app


app = create_app()
