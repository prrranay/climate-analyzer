"""Standardized API error models and responses."""

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Field-level error specification."""

    field: str | None = Field(default=None, description="Field path that triggered the error")
    issue: str = Field(..., description="Specific failure reason")


class ErrorResponse(BaseModel):
    """Standardized API error contract.

    Guarantees consistent error formatting across all routes without leaking
    internal stack traces, passwords, or raw upstream errors.
    """

    error_code: str = Field(
        ...,
        description=(
            "Machine-readable unique error code (e.g. VALIDATION_ERROR, INVALID_YEAR_RANGE)"
        ),
        examples=["INVALID_YEAR_RANGE"],
    )
    message: str = Field(
        ...,
        description="Safe, human-readable summary of the error",
        examples=["start_year (2020) must be less than or equal to end_year (2010)"],
    )
    details: list[dict[str, Any]] | None = Field(
        default=None,
        description="Optional granular error details or validation violations",
    )
    request_id: str | None = Field(
        default=None,
        description="Unique request tracing / correlation identifier",
    )
    timestamp: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat(),
        description="UTC ISO-8601 timestamp of when the error occurred",
    )
