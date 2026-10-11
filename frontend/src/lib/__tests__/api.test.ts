import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  apiClient,
  ApiError,
  roundCoord,
  buildQueryString,
  buildApiUrl,
  parseErrorBody,
} from "../api";
import {
  HeatwaveAnalysisResponse,
  FastApiValidationErrorResponse,
  ErrorResponse,
} from "@/types/api";

describe("API Client — URL Construction & Parameter Serialization", () => {
  it("rounds coordinates to 4 decimal places", () => {
    expect(roundCoord(52.5200456)).toBe(52.52);
    expect(roundCoord(-112.0740123)).toBe(-112.074);
    expect(roundCoord(0.123456)).toBe(0.1235);
    expect(roundCoord(17.0)).toBe(17);
  });

  it("builds query strings correctly omitting null, undefined, and empty values", () => {
    const qs = buildQueryString({
      latitude: 52.52,
      longitude: 13.41,
      baseline_start_year: null,
      baseline_end_year: undefined,
      model: "ERA5",
      empty_param: "",
    });
    expect(qs).toBe("?latitude=52.52&longitude=13.41&model=ERA5");
  });

  it("constructs full API URL without double slashes", () => {
    const url = buildApiUrl(
      "/api/v1/regions/search",
      { q: "Paris", count: 5 },
      "http://localhost:8000/"
    );
    expect(url).toBe("http://localhost:8000/api/v1/regions/search?q=Paris&count=5");
  });

  it("serializes point analysis parameters with rounded coordinates and required fields", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ location: { latitude: 33.4484, longitude: -112.074 } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await apiClient.analyzeHeatwave({
      latitude: 33.4484123,
      longitude: -112.0740999,
      start_year: 1980,
      end_year: 2023,
      threshold_percentile: 95.0,
      min_consecutive_days: 3,
      model: "ERA5",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe("/api/v1/analysis/heatwave");
    expect(calledUrl.searchParams.get("latitude")).toBe("33.4484");
    expect(calledUrl.searchParams.get("longitude")).toBe("-112.0741");
    expect(calledUrl.searchParams.get("start_year")).toBe("1980");
    expect(calledUrl.searchParams.get("end_year")).toBe("2023");
    expect(calledUrl.searchParams.get("threshold_percentile")).toBe("95");
    expect(calledUrl.searchParams.get("min_consecutive_days")).toBe("3");
    expect(calledUrl.searchParams.get("model")).toBe("ERA5");
    // Ensure nulls were not appended as "null"
    expect(calledUrl.searchParams.has("baseline_start_year")).toBe(false);
    expect(calledUrl.searchParams.has("baseline_end_year")).toBe(false);
  });

  it("serializes bounding box query parameters with correct field aliases", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bounding_box: { min_latitude: 17.0, max_latitude: 18.0 } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await apiClient.analyzeHeatwaveBbox({
      min_lat: 17.00001,
      max_lat: 18.00002,
      min_lon: 78.00003,
      max_lon: 79.00004,
      start_year: 2000,
      end_year: 2005,
      threshold_percentile: 95.0,
      min_consecutive_days: 3,
      model: "ERA5",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe("/api/v1/analysis/heatwave/bbox");
    expect(calledUrl.searchParams.get("min_lat")).toBe("17");
    expect(calledUrl.searchParams.get("max_lat")).toBe("18");
    expect(calledUrl.searchParams.get("min_lon")).toBe("78");
    expect(calledUrl.searchParams.get("max_lon")).toBe("79");
    expect(calledUrl.searchParams.get("start_year")).toBe("2000");
    expect(calledUrl.searchParams.get("end_year")).toBe("2005");
  });
});

describe("API Client — Response Parsing & Null Value Preservation", () => {
  it("preserves exact null values for zero-event years without coercing to zero", async () => {
    const mockPayload: Partial<HeatwaveAnalysisResponse> = {
      location: {
        latitude: 52.52,
        longitude: 13.41,
        name: "Berlin",
        country: "Germany",
        country_code: "DE",
        admin1: "Berlin",
        elevation: 34.0,
        timezone: "Europe/Berlin",
      },
      baseline: {
        baseline_start_year: 1991,
        baseline_end_year: 2020,
        percentile_threshold: 95.0,
        threshold_celsius: null, // Moving-window percentile threshold is null
        min_consecutive_days: 3,
      },
      annual_metrics: [
        {
          year: 1985,
          event_count: 0,
          total_heatwave_days: 0,
          max_duration_days: null, // Must remain null!
          mean_duration_days: null, // Must remain null!
          cumulative_intensity_degree_days: null, // Must remain null!
          peak_intensity_celsius: null, // Must remain null!
          mean_peak_temperature_celsius: null, // Must remain null!
          expected_days: 365,
          usable_days: 365,
          completeness_percentage: 100.0,
          quality_status: "reliable",
        },
      ],
      trends: {
        annual_frequency: {
          metric_name: "annual_frequency",
          slope_per_decade: null, // Insufficient data is null
          slope_per_year: null,
          intercept: null,
          p_value: null,
          direction: "indeterminate",
          is_significant: false,
          unit: "events/decade",
          sample_size_years: 5,
          description: null,
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await apiClient.analyzeHeatwave({
      latitude: 52.52,
      longitude: 13.41,
      start_year: 1980,
      end_year: 1990,
    });

    const metric = result.annual_metrics[0];
    expect(metric.event_count).toBe(0);
    expect(metric.max_duration_days).toBeNull();
    expect(metric.cumulative_intensity_degree_days).toBeNull();
    expect(metric.peak_intensity_celsius).toBeNull();
    expect(metric.mean_duration_days).toBeNull();
    expect(result.baseline.threshold_celsius).toBeNull();
    expect(result.trends.annual_frequency.slope_per_decade).toBeNull();
    expect(result.trends.annual_frequency.p_value).toBeNull();
  });
});

describe("API Client — Error Normalization & HTTP Behavior", () => {
  it("normalizes backend ErrorResponse envelope", () => {
    const errorEnvelope: ErrorResponse = {
      error_code: "INVALID_YEAR_RANGE",
      message: "start_year (2020) must be less than or equal to end_year (2010)",
      details: [{ field: "start_year", issue: "Invalid boundary" }],
      request_id: "req-12345",
      timestamp: "2026-10-12T00:00:00Z",
    };

    const err = parseErrorBody(400, errorEnvelope, "Bad Request");
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe("INVALID_YEAR_RANGE");
    expect(err.message).toBe("start_year (2020) must be less than or equal to end_year (2010)");
    expect(err.requestId).toBe("req-12345");
    expect(err.details).toEqual([{ field: "start_year", issue: "Invalid boundary" }]);
    expect(err.isValidationError).toBe(false);
  });

  it("normalizes standard FastAPI 422 validation errors into structured details", () => {
    const fastApi422: FastApiValidationErrorResponse = {
      detail: [
        {
          loc: ["query", "latitude"],
          msg: "Input should be greater than or equal to -90",
          type: "greater_than_equal",
        },
        {
          loc: ["query", "start_year"],
          msg: "Input should be greater than or equal to 1940",
          type: "greater_than_equal",
        },
      ],
    };

    const err = parseErrorBody(422, fastApi422, "Unprocessable Entity");
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.errorCode).toBe("VALIDATION_ERROR");
    expect(err.isValidationError).toBe(true);
    expect(err.details).toHaveLength(2);
    expect(err.details![0]).toEqual({
      field: "latitude",
      issue: "Input should be greater than or equal to -90",
    });
    expect(err.details![1]).toEqual({
      field: "start_year",
      issue: "Input should be greater than or equal to 1940",
    });
  });

  it("normalizes HTTP 429 rate limit with Retry-After header", () => {
    const err = parseErrorBody(429, { message: "Rate limit exceeded" }, "Too Many Requests", "30");
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
    expect(err.isRateLimited).toBe(true);
    expect(err.retryAfterSeconds).toBe(30);
    expect(err.message).toBe("Rate limit exceeded");
  });

  it("safely handles non-JSON HTML gateway errors without exposing markup", () => {
    const err502 = parseErrorBody(502, null, "Bad Gateway");
    expect(err502.status).toBe(502);
    expect(err502.errorCode).toBe("BAD_GATEWAY");
    expect(err502.message).toContain("temporarily unavailable");

    const err504 = parseErrorBody(504, null, "Gateway Timeout");
    expect(err504.status).toBe(504);
    expect(err504.errorCode).toBe("GATEWAY_TIMEOUT");
    expect(err504.message).toContain("timed out");
  });
});

describe("API Client — Cancellation & Request Lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("aborts in-flight request when caller abort signal fires", async () => {
    const controller = new AbortController();

    const mockFetch = vi.fn().mockImplementation((_url, { signal }: { signal: AbortSignal }) => {
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          const abortError = new DOMException("The user aborted a request.", "AbortError");
          reject(abortError);
        });
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const promise = apiClient.analyzeHeatwave(
      {
        latitude: 33.44,
        longitude: -112.07,
        start_year: 1980,
        end_year: 2020,
      },
      { signal: controller.signal }
    );

    controller.abort();

    await expect(promise).rejects.toThrow("Request was cancelled.");
    await expect(promise).rejects.toMatchObject({
      errorCode: "REQUEST_CANCELLED",
      isCancelled: true,
    });
  });

  it("rejects immediately if passed an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      apiClient.analyzeHeatwave(
        {
          latitude: 33.44,
          longitude: -112.07,
          start_year: 1980,
          end_year: 2020,
        },
        { signal: controller.signal }
      )
    ).rejects.toMatchObject({
      errorCode: "REQUEST_CANCELLED",
      isCancelled: true,
    });
  });

  it("handles network failure cleanly as a NetworkError", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      apiClient.searchRegions({ q: "Tokyo" })
    ).rejects.toMatchObject({
      errorCode: "NETWORK_ERROR",
      isNetworkError: true,
    });
  });

  it("returns empty array for search queries shorter than 2 characters without invoking fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const result = await apiClient.searchRegions({ q: "a" });
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls correct endpoints for liveness and readiness probes", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "alive" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await apiClient.checkLiveness();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/health/live"),
      expect.any(Object)
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ready" }),
    });

    await apiClient.checkReadiness();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/health/ready"),
      expect.any(Object)
    );
  });

  it("handles request timeouts cleanly by setting isTimeout", async () => {
    const mockFetch = vi.fn().mockImplementation((_url, { signal }: { signal: AbortSignal }) => {
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          const timeoutErr = new Error("REQUEST_TIMEOUT");
          timeoutErr.name = "AbortError";
          reject(timeoutErr);
        });
      });
    });
    vi.stubGlobal("fetch", mockFetch);

    const promise = apiClient.searchRegions(
      { q: "Berlin" },
      { timeoutMs: 10 }
    );

    await expect(promise).rejects.toMatchObject({
      errorCode: "REQUEST_TIMEOUT",
      isTimeout: true,
      status: 408,
    });
  });
});
