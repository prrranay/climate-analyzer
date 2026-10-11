/**
 * TypeScript interfaces mirroring the exact Pydantic request models, response
 * models, and error envelopes returned by the FastAPI backend.
 *
 * Every property name strictly matches backend/app/schemas/requests.py,
 * backend/app/schemas/responses.py, and backend/app/schemas/errors.py.
 * Nullable fields explicitly preserve `null` (not coerced to 0 or undefined).
 */

/* ------------------------------------------------------------------ */
/*  1. Request Parameter Models                                       */
/* ------------------------------------------------------------------ */

/**
 * Query parameters for region search / geocoding.
 * Maps to backend: `GET /api/v1/regions/search?q=...&count=...`
 */
export interface RegionSearchQuery {
  /** Search query for a city or region name (min_length=2, max_length=100) */
  q: string;
  /** Maximum candidates to return (default=5, ge=1, le=20) */
  count?: number;
}

/** Supported reanalysis model datasets */
export type ReanalysisModel = "ERA5" | "ERA5_LAND";

/**
 * Validated parameters for single-point heatwave analysis.
 * Maps to backend: `GET /api/v1/analysis/heatwave`
 */
export interface HeatwaveAnalysisQuery {
  /** WGS84 latitude coordinate [-90.0 to 90.0], rounded to 4 decimals */
  latitude: number;
  /** WGS84 longitude coordinate [-180.0 to 180.0], rounded to 4 decimals */
  longitude: number;
  /** Start year for analysis window (ge=1940) */
  start_year: number;
  /** End year for analysis window (start_year <= end_year <= current UTC year, span <= 85) */
  end_year: number;
  /** Optional custom baseline period start year (ge=1940) */
  baseline_start_year?: number | null;
  /** Optional custom baseline period end year (ge=1940, baseline_start_year < baseline_end_year) */
  baseline_end_year?: number | null;
  /** Regional temperature percentile threshold (typically 95.0, [80.0, 99.9]) */
  threshold_percentile?: number;
  /** Minimum consecutive days above threshold to qualify as heatwave (default=3, [2, 30]) */
  min_consecutive_days?: number;
  /** Supported reanalysis model source ("ERA5" or "ERA5_LAND", default="ERA5") */
  model?: ReanalysisModel;
}

/**
 * Validated query parameters for regional bounding-box heatwave analysis.
 * Maps to backend: `GET /api/v1/analysis/heatwave/bbox`
 */
export interface BoundingBoxAnalysisQuery {
  /** Southern bounding latitude [-90.0, 90.0] */
  min_lat: number;
  /** Northern bounding latitude [-90.0, 90.0], min_lat < max_lat */
  max_lat: number;
  /** Western bounding longitude [-180.0, 180.0] */
  min_lon: number;
  /** Eastern bounding longitude [-180.0, 180.0], min_lon < max_lon */
  max_lon: number;
  /** First year of requested analysis period (inclusive, ge=1940) */
  start_year: number;
  /** Last year of requested analysis period (inclusive, <= current UTC year, span <= 85) */
  end_year: number;
  /** Optional custom baseline start year */
  baseline_start_year?: number | null;
  /** Optional custom baseline end year */
  baseline_end_year?: number | null;
  /** Percentile threshold for heatwave detection (default=95.0, [50.0, 99.9]) */
  threshold_percentile?: number;
  /** Minimum consecutive days above threshold (default=3, [2, 30]) */
  min_consecutive_days?: number;
  /** Supported reanalysis model source ("ERA5" or "ERA5_LAND", default="ERA5") */
  model?: ReanalysisModel;
}

// Backwards-compatible aliases
export type HeatwaveAnalysisParams = HeatwaveAnalysisQuery;
export type BoundingBoxAnalysisParams = BoundingBoxAnalysisQuery;

/* ------------------------------------------------------------------ */
/*  2. Response Models & Sub-Schemas                                  */
/* ------------------------------------------------------------------ */

/**
 * Geographic entity representation.
 * Maps to backend `GeoLocationDTO`.
 */
export interface GeoLocationDTO {
  latitude: number;
  longitude: number;
  name: string | null;
  country: string | null;
  country_code: string | null;
  admin1: string | null;
  elevation: number | null;
  timezone: string;
}

/**
 * Metadata describing the upstream meteorological reanalysis source.
 * Maps to backend `DataSourceMetadataDTO`.
 */
export interface DataSourceMetadataDTO {
  provider: string;
  dataset: string;
  resolution: string;
  variable: string;
  unit: string;
}

/**
 * Reference climatological baseline parameters.
 * Maps to backend `BaselineConfigDTO`.
 */
export interface BaselineConfigDTO {
  baseline_start_year: number;
  baseline_end_year: number;
  percentile_threshold: number;
  /** Constant threshold in °C if static; null when using DOY moving-window percentiles */
  threshold_celsius: number | null;
  min_consecutive_days: number;
}

/**
 * Analysis temporal scope.
 * Maps to backend `AnalysisWindowDTO`.
 */
export interface AnalysisWindowDTO {
  start_year: number;
  end_year: number;
  total_years: number;
}

/**
 * Diagnostics indicating data completeness and observation integrity.
 * Maps to backend `DataQualityDTO`.
 */
export interface DataQualityDTO {
  total_expected_days: number;
  observed_days: number;
  missing_days: number;
  /** Percentage of expected days with valid data [0.0 - 100.0%] */
  completeness_percentage: number;
  /** Set when missing data exceeds safe tolerance or has large continuous gaps (>15d) */
  has_critical_gaps: boolean;
  longest_missing_streak_days: number;
}

/** Data quality classification */
export type QualityStatus =
  | "reliable"
  | "incomplete"
  | "insufficient_data"
  | "provisional";

/**
 * Annual aggregated hazard summary.
 * Note: Genuine zero occurrences (event_count == 0) leave duration/intensity fields as null.
 * Maps to backend `AnnualHeatwaveMetricDTO`.
 */
export interface AnnualHeatwaveMetricDTO {
  year: number;
  /** Number of distinct heatwave events (genuine zero if none) */
  event_count: number;
  total_heatwave_days: number;
  /** Maximum event duration in days (null if event_count is 0) */
  max_duration_days: number | null;
  /** Average event duration in days (null if event_count is 0) */
  mean_duration_days: number | null;
  /** Annual sum of degree-days above threshold (null if event_count is 0) */
  cumulative_intensity_degree_days: number | null;
  /** Highest single-day exceedance above threshold in °C (null if event_count is 0) */
  peak_intensity_celsius: number | null;
  /** Average peak temperature of events in that year in °C (null if event_count is 0) */
  mean_peak_temperature_celsius: number | null;
  expected_days: number;
  usable_days: number;
  completeness_percentage: number;
  quality_status: QualityStatus;
}

/** Trend direction classifications */
export type TrendDirection =
  | "increasing"
  | "decreasing"
  | "stable"
  | "indeterminate";

/**
 * Statistical long-term trend summary for a specific hazard metric.
 * Maps to backend `TrendStatisticsDTO`.
 */
export interface TrendStatisticsDTO {
  metric_name: string;
  /** Decadal rate of change (null if insufficient data < 10 reliable years) */
  slope_per_decade: number | null;
  /** Annual rate of change (null if insufficient data) */
  slope_per_year: number | null;
  intercept: number | null;
  p_value: number | null;
  direction: TrendDirection;
  is_significant: boolean;
  unit: string;
  sample_size_years: number;
  description: string | null;
}

/**
 * Detailed summary of a single discrete heatwave event.
 * Maps to backend `HeatwaveEventDTO`.
 */
export interface HeatwaveEventDTO {
  start_date: string;
  end_date: string;
  duration_days: number;
  threshold_celsius: number;
  peak_temperature_celsius: number;
  peak_exceedance_celsius: number;
  cumulative_exceedance_degree_days: number;
  mean_exceedance_celsius: number;
}

/**
 * Complete comprehensive response contract for single-point analysis.
 * Maps to backend `HeatwaveAnalysisResponse`.
 */
export interface HeatwaveAnalysisResponse {
  location: GeoLocationDTO;
  data_source: DataSourceMetadataDTO;
  baseline: BaselineConfigDTO;
  analysis_window: AnalysisWindowDTO;
  data_quality: DataQualityDTO;
  annual_metrics: AnnualHeatwaveMetricDTO[];
  recent_events: HeatwaveEventDTO[];
  trends: Record<string, TrendStatisticsDTO>;
  insights: string[];
  generated_at: string;
}

/**
 * Bounding box geographic extent representation.
 * Maps to backend `BoundingBoxDTO`.
 */
export interface BoundingBoxDTO {
  min_latitude: number;
  max_latitude: number;
  min_longitude: number;
  max_longitude: number;
  area_square_degrees: number;
}

/**
 * Spatial grid sampling configuration and diagnostics.
 * Maps to backend `SpatialSamplingDTO`.
 */
export interface SpatialSamplingDTO {
  grid_points_count: number;
  sample_coordinates: GeoLocationDTO[];
  spatial_aggregation_method: string;
  min_point_coverage_ratio: number;
  spatial_completeness_percentage: number;
  disclaimer: string;
}

/**
 * Complete response contract for regional bounding-box heatwave analysis.
 * Maps to backend `BoundingBoxHeatwaveAnalysisResponse`.
 */
export interface BoundingBoxHeatwaveAnalysisResponse {
  bounding_box: BoundingBoxDTO;
  spatial_sampling: SpatialSamplingDTO;
  data_source: DataSourceMetadataDTO;
  baseline: BaselineConfigDTO;
  analysis_window: AnalysisWindowDTO;
  data_quality: DataQualityDTO;
  annual_metrics: AnnualHeatwaveMetricDTO[];
  recent_events: HeatwaveEventDTO[];
  trends: Record<string, TrendStatisticsDTO>;
  insights: string[];
  generated_at: string;
}

/* ------------------------------------------------------------------ */
/*  3. Health Check Responses                                         */
/* ------------------------------------------------------------------ */

export interface LivenessResponse {
  status: "alive";
  timestamp: string;
  app: string;
  environment: string;
}

export interface ComponentStatus {
  mongodb: "connected" | "disconnected";
  redis: "connected" | "disconnected";
}

export interface ReadinessResponse {
  status: "ready" | "not_ready";
  timestamp: string;
  components: ComponentStatus;
}

/* ------------------------------------------------------------------ */
/*  4. Error Response Models                                          */
/* ------------------------------------------------------------------ */

export interface ErrorDetail {
  field?: string;
  issue: string;
}

/** Standard backend custom error envelope */
export interface ErrorResponse {
  error_code: string;
  message: string;
  details: Array<Record<string, unknown>> | null;
  request_id: string | null;
  timestamp: string;
}

/** Standard FastAPI validation error envelope (HTTP 422 default) */
export interface FastApiValidationErrorItem {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface FastApiValidationErrorResponse {
  detail: FastApiValidationErrorItem[];
}
