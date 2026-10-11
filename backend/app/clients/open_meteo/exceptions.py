"""Exceptions raised by Open-Meteo API clients."""


class OpenMeteoError(Exception):
    """Base exception for all Open-Meteo client errors."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class OpenMeteoClientError(OpenMeteoError):
    """Raised when upstream returns non-retriable 4xx errors (e.g. 400 Bad Request)."""


class OpenMeteoRateLimitError(OpenMeteoError):
    """Raised when Open-Meteo rate limit (HTTP 429) is exceeded."""

    def __init__(self, message: str, retry_after: float | None = None) -> None:
        super().__init__(message, status_code=429)
        self.retry_after = retry_after


class OpenMeteoUpstreamError(OpenMeteoError):
    """Raised when Open-Meteo returns 5xx errors or connectivity fails after retries."""


class OpenMeteoMalformedPayloadError(OpenMeteoError):
    """Raised when upstream response payload does not conform to expected schema."""
