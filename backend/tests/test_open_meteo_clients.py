"""Unit tests for Open-Meteo Historical Weather and Geocoding API clients."""

from datetime import date

import httpx
import pytest
import respx

from app.clients.open_meteo import (
    OpenMeteoClientError,
    OpenMeteoGeocodingClient,
    OpenMeteoHistoricalWeatherClient,
    OpenMeteoMalformedPayloadError,
    OpenMeteoRateLimitError,
    OpenMeteoUpstreamError,
)
from app.domain.models import GeoLocation


@pytest.fixture
def sample_location() -> GeoLocation:
    """Fixture providing a standard location."""
    return GeoLocation(latitude=52.52, longitude=13.41, name="Berlin", country="Germany")


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_success(sample_location: GeoLocation):
    """Test successful historical daily weather fetching and normalization."""
    mock_payload = {
        "latitude": 52.52,
        "longitude": 13.41,
        "generationtime_ms": 1.5,
        "utc_offset_seconds": 0,
        "timezone": "UTC",
        "daily_units": {"time": "iso8601", "temperature_2m_max": "°C"},
        "daily": {
            "time": ["2023-07-01", "2023-07-02", "2023-07-03"],
            "temperature_2m_max": [29.5, 31.2, 33.8],
        },
    }

    route = respx.get("https://archive-api.open-meteo.com/v1/archive").respond(
        status_code=200, json=mock_payload
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=1, backoff_factor=0.01
        )
        observations, stats = await client.fetch_historical_with_quality(
            location=sample_location,
            start_date=date(2023, 7, 1),
            end_date=date(2023, 7, 3),
            model="ERA5",
        )

    assert route.called
    assert len(observations) == 3
    assert observations[0].date == date(2023, 7, 1)
    assert observations[0].temp_max == 29.5
    assert observations[0].unit == "°C"
    assert observations[0].source_model == "ERA5"
    assert observations[0].is_valid is True

    assert stats.total_expected_days == 3
    assert stats.observed_days == 3
    assert stats.missing_days == 0
    assert stats.completeness_ratio == 1.0
    assert stats.has_critical_gaps is False


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_with_explicit_missing_values(sample_location: GeoLocation):
    """Test handling of null/missing measurements in upstream response without interpolation."""
    mock_payload = {
        "latitude": 52.52,
        "longitude": 13.41,
        "daily": {
            "time": ["2023-07-01", "2023-07-02", "2023-07-03"],
            "temperature_2m_max": [28.0, None, 32.5],
        },
    }

    respx.get("https://archive-api.open-meteo.com/v1/archive").respond(
        status_code=200, json=mock_payload
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=1, backoff_factor=0.01
        )
        observations, stats = await client.fetch_historical_with_quality(
            location=sample_location,
            start_date=date(2023, 7, 1),
            end_date=date(2023, 7, 3),
        )

    assert len(observations) == 3
    assert observations[1].temp_max is None
    assert observations[1].is_valid is False
    assert stats.observed_days == 2
    assert stats.missing_days == 1


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_calendar_omission_filling(sample_location: GeoLocation):
    """Test that omitted calendar days are generated as explicit missing-value records."""
    # Upstream only returns July 1, 2, and 5 (omits July 3 and 4)
    mock_payload = {
        "latitude": 52.52,
        "longitude": 13.41,
        "daily": {
            "time": ["2023-07-01", "2023-07-02", "2023-07-05"],
            "temperature_2m_max": [25.0, 26.0, 29.0],
        },
    }

    respx.get("https://archive-api.open-meteo.com/v1/archive").respond(
        status_code=200, json=mock_payload
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=1, backoff_factor=0.01
        )
        observations, stats = await client.fetch_historical_with_quality(
            location=sample_location,
            start_date=date(2023, 7, 1),
            end_date=date(2023, 7, 5),
        )

    # Must contain all 5 calendar days
    assert len(observations) == 5
    assert [obs.date for obs in observations] == [
        date(2023, 7, 1),
        date(2023, 7, 2),
        date(2023, 7, 3),
        date(2023, 7, 4),
        date(2023, 7, 5),
    ]
    # July 3 and July 4 must have temp_max=None (never interpolated!)
    assert observations[2].temp_max is None
    assert observations[3].temp_max is None
    assert stats.observed_days == 3
    assert stats.missing_days == 2
    assert stats.longest_missing_streak_days == 2


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_malformed_mismatched_lengths(sample_location: GeoLocation):
    """Test error when upstream arrays have mismatched lengths."""
    mock_payload = {
        "latitude": 52.52,
        "longitude": 13.41,
        "daily": {
            "time": ["2023-07-01", "2023-07-02"],
            "temperature_2m_max": [25.0],  # only 1 temperature
        },
    }

    respx.get("https://archive-api.open-meteo.com/v1/archive").respond(
        status_code=200, json=mock_payload
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=1, backoff_factor=0.01
        )
        with pytest.raises(OpenMeteoMalformedPayloadError, match="Mismatched array lengths"):
            await client.fetch_historical_daily(
                location=sample_location,
                start_date=date(2023, 7, 1),
                end_date=date(2023, 7, 2),
            )


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_duplicate_dates(sample_location: GeoLocation):
    """Test error when upstream returns duplicate dates."""
    mock_payload = {
        "latitude": 52.52,
        "longitude": 13.41,
        "daily": {
            "time": ["2023-07-01", "2023-07-01"],
            "temperature_2m_max": [25.0, 26.0],
        },
    }

    respx.get("https://archive-api.open-meteo.com/v1/archive").respond(
        status_code=200, json=mock_payload
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=1, backoff_factor=0.01
        )
        with pytest.raises(OpenMeteoMalformedPayloadError, match="Duplicate date"):
            await client.fetch_historical_daily(
                location=sample_location,
                start_date=date(2023, 7, 1),
                end_date=date(2023, 7, 2),
            )


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_client_error_400_no_retry(sample_location: GeoLocation):
    """Test that ordinary 4xx errors are not retried and raise OpenMeteoClientError."""
    route = respx.get("https://archive-api.open-meteo.com/v1/archive").respond(
        status_code=400, text="Bad Request: Invalid coordinates"
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=3, backoff_factor=0.01
        )
        with pytest.raises(OpenMeteoClientError, match="status 400"):
            await client.fetch_historical_daily(
                location=sample_location,
                start_date=date(2023, 7, 1),
                end_date=date(2023, 7, 2),
            )

    # Must only be called once (no retry for 400)
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_rate_limit_retry_and_recovery(sample_location: GeoLocation):
    """Test 429 rate limit backoff and successful recovery on subsequent retry."""
    success_payload = {
        "latitude": 52.52,
        "longitude": 13.41,
        "daily": {"time": ["2023-07-01"], "temperature_2m_max": [27.0]},
    }

    route = respx.get("https://archive-api.open-meteo.com/v1/archive")
    route.side_effect = [
        httpx.Response(429, headers={"Retry-After": "0.01"}),
        httpx.Response(200, json=success_payload),
    ]

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=2, backoff_factor=0.01
        )
        observations = await client.fetch_historical_daily(
            location=sample_location,
            start_date=date(2023, 7, 1),
            end_date=date(2023, 7, 1),
        )

    assert route.call_count == 2
    assert len(observations) == 1
    assert observations[0].temp_max == 27.0


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_rate_limit_exhausted(sample_location: GeoLocation):
    """Test that exhausting retries on 429 raises OpenMeteoRateLimitError."""
    respx.get("https://archive-api.open-meteo.com/v1/archive").respond(
        status_code=429, headers={"Retry-After": "0.01"}
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=1, backoff_factor=0.01
        )
        with pytest.raises(OpenMeteoRateLimitError, match="rate limit exceeded"):
            await client.fetch_historical_daily(
                location=sample_location,
                start_date=date(2023, 7, 1),
                end_date=date(2023, 7, 1),
            )


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_server_error_503_retry_and_recovery(sample_location: GeoLocation):
    """Test that 503 errors trigger backoff retry and recover."""
    success_payload = {
        "latitude": 52.52,
        "longitude": 13.41,
        "daily": {"time": ["2023-07-01"], "temperature_2m_max": [30.0]},
    }

    route = respx.get("https://archive-api.open-meteo.com/v1/archive")
    route.side_effect = [
        httpx.Response(503, text="Service Unavailable"),
        httpx.Response(200, json=success_payload),
    ]

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=2, backoff_factor=0.01
        )
        obs = await client.fetch_historical_daily(
            location=sample_location,
            start_date=date(2023, 7, 1),
            end_date=date(2023, 7, 1),
        )

    assert route.call_count == 2
    assert obs[0].temp_max == 30.0


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_server_error_exhausted(sample_location: GeoLocation):
    """Test that exhausting 5xx retries raises OpenMeteoUpstreamError."""
    respx.get("https://archive-api.open-meteo.com/v1/archive").respond(status_code=500)

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=1, backoff_factor=0.01
        )
        with pytest.raises(OpenMeteoUpstreamError, match="status 500"):
            await client.fetch_historical_daily(
                location=sample_location,
                start_date=date(2023, 7, 1),
                end_date=date(2023, 7, 1),
            )


@pytest.mark.asyncio
@respx.mock
async def test_fetch_historical_timeout_retry_exhausted(sample_location: GeoLocation):
    """Test that persistent network timeout raises OpenMeteoUpstreamError."""
    respx.get("https://archive-api.open-meteo.com/v1/archive").mock(
        side_effect=httpx.ReadTimeout("Connection timed out")
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoHistoricalWeatherClient(
            client=http_client, max_retries=1, backoff_factor=0.01
        )
        with pytest.raises(OpenMeteoUpstreamError, match="Failed to communicate with Open-Meteo"):
            await client.fetch_historical_daily(
                location=sample_location,
                start_date=date(2023, 7, 1),
                end_date=date(2023, 7, 1),
            )


# ---------------- Geocoding Client Tests ----------------


@pytest.mark.asyncio
@respx.mock
async def test_geocoding_success():
    """Test successful geocoding location resolution."""
    mock_payload = {
        "results": [
            {
                "id": 2950159,
                "name": "Berlin",
                "latitude": 52.52437,
                "longitude": 13.41053,
                "elevation": 74.0,
                "country": "Germany",
                "country_code": "DE",
                "admin1": "Land Berlin",
                "timezone": "Europe/Berlin",
            },
            {
                "id": 524901,
                "name": "Moscow",
                "latitude": 55.75222,
                "longitude": 37.61556,
                "country": "Russia",
                "country_code": "RU",
            },
        ]
    }

    respx.get("https://geocoding-api.open-meteo.com/v1/search").respond(
        status_code=200, json=mock_payload
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoGeocodingClient(client=http_client)
        results = await client.search_locations(query="Berlin", limit=5)

    assert len(results) == 2
    assert results[0].name == "Berlin"
    assert results[0].latitude == 52.5244
    assert results[0].longitude == 13.4105
    assert results[0].country == "Germany"
    assert results[0].country_code == "DE"
    assert results[0].admin1 == "Land Berlin"
    assert results[0].timezone == "Europe/Berlin"


@pytest.mark.asyncio
@respx.mock
async def test_geocoding_empty_results():
    """Test handling of no matching locations from upstream."""
    mock_payload = {"generationtime_ms": 0.05}  # No results key

    respx.get("https://geocoding-api.open-meteo.com/v1/search").respond(
        status_code=200, json=mock_payload
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoGeocodingClient(client=http_client)
        results = await client.search_locations(query="NonExistentPlace")

    assert results == []


@pytest.mark.asyncio
async def test_geocoding_empty_query():
    """Test that empty or whitespace query returns empty list without network call."""
    client = OpenMeteoGeocodingClient()
    results = await client.search_locations(query="   ")
    assert results == []


@pytest.mark.asyncio
@respx.mock
async def test_geocoding_rate_limit_429():
    """Test rate limiting on geocoding client."""
    respx.get("https://geocoding-api.open-meteo.com/v1/search").respond(
        status_code=429, headers={"Retry-After": "0.01"}
    )

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoGeocodingClient(client=http_client, max_retries=1, backoff_factor=0.01)
        with pytest.raises(OpenMeteoRateLimitError):
            await client.search_locations(query="Paris")


@pytest.mark.asyncio
@respx.mock
async def test_geocoding_upstream_500_failure():
    """Test upstream failure on geocoding client."""
    respx.get("https://geocoding-api.open-meteo.com/v1/search").respond(status_code=500)

    async with httpx.AsyncClient() as http_client:
        client = OpenMeteoGeocodingClient(client=http_client, max_retries=1, backoff_factor=0.01)
        with pytest.raises(OpenMeteoUpstreamError):
            await client.search_locations(query="Paris")
