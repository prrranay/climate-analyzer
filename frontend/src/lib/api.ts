/**
 * Centralized, type-safe API client for the FastAPI backend.
 *
 * Implements:
 * - Configurable base URL
 * - Strict query parameter serialization with coordinate rounding
 * - Typed and normalized error responses (handling ErrorResponse, FastAPI 422, 429, 502/504)
 * - Request cancellation via AbortSignal & configurable timeouts
 * - Safe error handling (never exposes internal stack traces to callers)
 */

import { API_BASE_URL } from "./config";
import {
  RegionSearchQuery,
  HeatwaveAnalysisQuery,
  BoundingBoxAnalysisQuery,
  GeoLocationDTO,
  HeatwaveAnalysisResponse,
  BoundingBoxHeatwaveAnalysisResponse,
  LivenessResponse,
  ReadinessResponse,
  ErrorDetail,
  FastApiValidationErrorResponse,
} from "@/types/api";

/* ------------------------------------------------------------------ */
/*  1. Typed API Error Hierarchy                                      */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  public readonly status: number;
  public readonly errorCode: string;
  public readonly details: ErrorDetail[] | null;
  public readonly requestId: string | null;
  public readonly retryAfterSeconds: number | null;
  public readonly isRateLimited: boolean;
  public readonly isValidationError: boolean;
  public readonly isNetworkError: boolean;
  public readonly isTimeout: boolean;
  public readonly isCancelled: boolean;

  constructor(params: {
    status: number;
    errorCode: string;
    message: string;
    details?: ErrorDetail[] | null;
    requestId?: string | null;
    retryAfterSeconds?: number | null;
    isNetworkError?: boolean;
    isTimeout?: boolean;
    isCancelled?: boolean;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.errorCode = params.errorCode;
    this.details = params.details || null;
    this.requestId = params.requestId || null;
    this.retryAfterSeconds = params.retryAfterSeconds || null;
    this.isRateLimited = params.status === 429;
    this.isValidationError = params.status === 422 || params.errorCode === "VALIDATION_ERROR";
    this.isNetworkError = Boolean(params.isNetworkError);
    this.isTimeout = Boolean(params.isTimeout);
    this.isCancelled = Boolean(params.isCancelled);
  }
}

/* ------------------------------------------------------------------ */
/*  2. Request Options & Serialization Helpers                        */
/* ------------------------------------------------------------------ */

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  baseUrl?: string;
}

/** Round float coordinates to 4 decimal places matching backend caching rule */
export function roundCoord(val: number): number {
  return Math.round(val * 10000) / 10000;
}

/**
 * Builds a clean URL query string, omitting null, undefined, and empty string values.
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      searchParams.append(key, String(val));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Constructs a fully qualified URL for a backend endpoint given base URL, path, and query parameters.
 */
export function buildApiUrl(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
  baseUrl: string = API_BASE_URL
): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const qs = params ? buildQueryString(params) : "";
  return `${cleanBase}${cleanPath}${qs}`;
}

/* ------------------------------------------------------------------ */
/*  3. Error Parsing & Normalization                                  */
/* ------------------------------------------------------------------ */

/**
 * Parses and normalizes diverse backend error bodies into structured ErrorDetail items.
 */
export function parseErrorBody(
  status: number,
  rawBody: unknown,
  statusText: string,
  retryAfterHeader?: string | null
): ApiError {
  let retryAfterSeconds: number | null = null;
  if (retryAfterHeader) {
    const parsed = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsed) && parsed > 0) {
      retryAfterSeconds = parsed;
    }
  }

  const bodyRecord =
    typeof rawBody === "object" && rawBody !== null
      ? (rawBody as Record<string, unknown>)
      : null;

  // Handle HTTP 429 Rate Limit
  if (status === 429) {
    const defaultMsg = retryAfterSeconds
      ? `Rate limit exceeded. Please retry after ${retryAfterSeconds} seconds.`
      : "API rate limit exceeded. Please wait a moment before sending another request.";
    const message =
      typeof bodyRecord?.message === "string"
        ? bodyRecord.message
        : typeof bodyRecord?.detail === "string"
        ? bodyRecord.detail
        : defaultMsg;

    return new ApiError({
      status: 429,
      errorCode: "RATE_LIMIT_EXCEEDED",
      message,
      retryAfterSeconds,
    });
  }

  // Handle standard backend custom ErrorResponse envelope: { error_code, message, details, request_id }
  if (bodyRecord && typeof bodyRecord.error_code === "string" && typeof bodyRecord.message === "string") {
    const details: ErrorDetail[] = [];
    if (Array.isArray(bodyRecord.details)) {
      for (const item of bodyRecord.details) {
        if (typeof item === "object" && item !== null) {
          const itemRecord = item as Record<string, unknown>;
          const field = typeof itemRecord.field === "string" ? itemRecord.field : undefined;
          const issue = typeof itemRecord.issue === "string" ? itemRecord.issue : JSON.stringify(item);
          details.push({ field, issue });
        }
      }
    }
    return new ApiError({
      status,
      errorCode: bodyRecord.error_code,
      message: bodyRecord.message,
      details: details.length > 0 ? details : null,
      requestId: typeof bodyRecord.request_id === "string" ? bodyRecord.request_id : null,
    });
  }

  // Handle standard FastAPI 422 Validation Error: { detail: [{ loc: [...], msg: "...", type: "..." }] }
  if (
    bodyRecord &&
    Array.isArray(bodyRecord.detail)
  ) {
    const fastApiErrors = bodyRecord.detail as FastApiValidationErrorResponse["detail"];
    const details: ErrorDetail[] = fastApiErrors.map((item) => {
      const field = Array.isArray(item.loc) ? item.loc.filter((x) => x !== "query" && x !== "body").join(".") : undefined;
      return {
        field: field || undefined,
        issue: item.msg,
      };
    });

    const summaryMessage =
      details.length === 1
        ? `Validation error: ${details[0].issue}${details[0].field ? ` on field '${details[0].field}'` : ""}`
        : `Validation error: ${details.length} parameter constraints failed.`;

    return new ApiError({
      status,
      errorCode: "VALIDATION_ERROR",
      message: summaryMessage,
      details,
    });
  }

  // Handle FastAPI simple detail string: { detail: "..." }
  if (typeof bodyRecord?.detail === "string") {
    return new ApiError({
      status,
      errorCode: `HTTP_${status}`,
      message: bodyRecord.detail,
    });
  }

  // Handle non-JSON HTML error (e.g. 502 Bad Gateway or 504 Gateway Timeout)
  if (status === 502) {
    return new ApiError({
      status: 502,
      errorCode: "BAD_GATEWAY",
      message: "The backend server or upstream weather provider is temporarily unavailable (HTTP 502).",
    });
  }

  if (status === 504) {
    return new ApiError({
      status: 504,
      errorCode: "GATEWAY_TIMEOUT",
      message: "The backend service timed out waiting for upstream data (HTTP 504).",
    });
  }

  return new ApiError({
    status,
    errorCode: `HTTP_${status}`,
    message: `Request failed with HTTP status ${status}${statusText ? ` (${statusText})` : ""}.`,
  });
}

/* ------------------------------------------------------------------ */
/*  4. Core HTTP Request Dispatcher                                   */
/* ------------------------------------------------------------------ */

async function executeRequest<T>(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
  options: RequestOptions = {}
): Promise<T> {
  const url = buildApiUrl(path, params, options.baseUrl);
  const timeoutMs = options.timeoutMs ?? 60000;

  // Setup abort controller with timeout handling
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error("REQUEST_TIMEOUT"));
    }, timeoutMs);
  }

  // Link caller's external AbortSignal if provided
  const onCallerAbort = () => controller.abort(options.signal?.reason);
  if (options.signal) {
    if (options.signal.aborted) {
      if (timeoutId) clearTimeout(timeoutId);
      throw new ApiError({
        status: 0,
        errorCode: "REQUEST_CANCELLED",
        message: "Request was cancelled.",
        isCancelled: true,
      });
    }
    options.signal.addEventListener("abort", onCallerAbort, { once: true });
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let rawJson: unknown = null;
      try {
        rawJson = await response.json();
      } catch {
        // Body was HTML or non-JSON
      }

      const retryAfter = response.headers.get("Retry-After");
      throw parseErrorBody(response.status, rawJson, response.statusText, retryAfter);
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }

    const isTimeout =
      controller.signal.reason === "REQUEST_TIMEOUT" ||
      (typeof controller.signal.reason === "object" &&
        controller.signal.reason !== null &&
        "message" in controller.signal.reason &&
        (controller.signal.reason as { message: string }).message === "REQUEST_TIMEOUT") ||
      (err instanceof Error && err.message === "REQUEST_TIMEOUT");

    const isAbort =
      isTimeout ||
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError") ||
      controller.signal.aborted;

    if (isAbort) {
      if (isTimeout) {
        throw new ApiError({
          status: 408,
          errorCode: "REQUEST_TIMEOUT",
          message: `The analysis request timed out (${timeoutMs / 1000}s) while ingesting historical climate records. Please retry in a few moments as data is cached.`,
          isTimeout: true,
        });
      }

      throw new ApiError({
        status: 0,
        errorCode: "REQUEST_CANCELLED",
        message: "Request was cancelled.",
        isCancelled: true,
      });
    }

    // Network disconnection or fetch failure
    throw new ApiError({
      status: 0,
      errorCode: "NETWORK_ERROR",
      message:
        "Unable to reach the climate analysis server. Please check your internet connection or verify the backend is running.",
      isNetworkError: true,
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener("abort", onCallerAbort);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  5. Public API Client Operations                                   */
/* ------------------------------------------------------------------ */

export const apiClient = {
  /**
   * Search for geographical locations / cities by name.
   * Maps to: `GET /api/v1/regions/search?q={query}&count={count}`
   */
  async searchRegions(
    params: RegionSearchQuery,
    options?: RequestOptions
  ): Promise<GeoLocationDTO[]> {
    const trimmed = params.q.trim();
    if (trimmed.length < 2) {
      return [];
    }

    return executeRequest<GeoLocationDTO[]>(
      "/api/v1/regions/search",
      {
        q: trimmed,
        count: params.count ?? 5,
      },
      options
    );
  },

  /**
   * Run single-point heatwave climate analysis.
   * Maps to: `GET /api/v1/analysis/heatwave`
   */
  async analyzeHeatwave(
    params: HeatwaveAnalysisQuery,
    options?: RequestOptions
  ): Promise<HeatwaveAnalysisResponse> {
    return executeRequest<HeatwaveAnalysisResponse>(
      "/api/v1/analysis/heatwave",
      {
        latitude: roundCoord(params.latitude),
        longitude: roundCoord(params.longitude),
        start_year: params.start_year,
        end_year: params.end_year,
        baseline_start_year: params.baseline_start_year,
        baseline_end_year: params.baseline_end_year,
        threshold_percentile: params.threshold_percentile,
        min_consecutive_days: params.min_consecutive_days,
        model: params.model,
      },
      {
        timeoutMs: 60000,
        ...options,
      }
    );
  },

  /**
   * Run regional bounding-box heatwave climate analysis.
   * Maps to: `GET /api/v1/analysis/heatwave/bbox`
   */
  async analyzeHeatwaveBbox(
    params: BoundingBoxAnalysisQuery,
    options?: RequestOptions
  ): Promise<BoundingBoxHeatwaveAnalysisResponse> {
    return executeRequest<BoundingBoxHeatwaveAnalysisResponse>(
      "/api/v1/analysis/heatwave/bbox",
      {
        min_lat: roundCoord(params.min_lat),
        max_lat: roundCoord(params.max_lat),
        min_lon: roundCoord(params.min_lon),
        max_lon: roundCoord(params.max_lon),
        start_year: params.start_year,
        end_year: params.end_year,
        baseline_start_year: params.baseline_start_year,
        baseline_end_year: params.baseline_end_year,
        threshold_percentile: params.threshold_percentile,
        min_consecutive_days: params.min_consecutive_days,
        model: params.model,
      },
      {
        timeoutMs: 90000, // Allow up to 90s for cold upstream multi-point ERA5 ingestion
        ...options,
      }
    );
  },

  /**
   * Check backend application liveness.
   * Maps to: `GET /api/v1/health/live`
   */
  async checkLiveness(options?: RequestOptions): Promise<LivenessResponse> {
    return executeRequest<LivenessResponse>("/api/v1/health/live", undefined, options);
  },

  /**
   * Check backend infrastructure readiness (MongoDB & Redis).
   * Maps to: `GET /api/v1/health/ready`
   */
  async checkReadiness(options?: RequestOptions): Promise<ReadinessResponse> {
    return executeRequest<ReadinessResponse>("/api/v1/health/ready", undefined, options);
  },
};

// Backwards-compatible export
export const api = {
  ...apiClient,
  searchRegions: (query: string, count: number = 5, signal?: AbortSignal) =>
    apiClient.searchRegions({ q: query, count }, { signal }),
  analyzeHeatwave: (params: HeatwaveAnalysisQuery, signal?: AbortSignal) =>
    apiClient.analyzeHeatwave(params, { signal }),
  analyzeHeatwaveBbox: (params: BoundingBoxAnalysisQuery, signal?: AbortSignal) =>
    apiClient.analyzeHeatwaveBbox(params, { signal }),
  checkHealth: (signal?: AbortSignal) => apiClient.checkLiveness({ signal }),
};
