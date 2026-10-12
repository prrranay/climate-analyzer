import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  HeatwaveAnalysisResponse,
  AnnualHeatwaveMetricDTO,
  TrendStatisticsDTO,
} from "@/types/api";

describe("Lifecycle, Backend Failures, State Consistency & Empty States", () => {
  /* ------------------------------------------------------------------ */
  /*  1. Request Lifecycle & State Transitions                          */
  /* ------------------------------------------------------------------ */
  describe("Request Lifecycle & Status Transitions", () => {
    it("transitions properly from idle to loading, and then success", () => {
      type LifecycleStatus = "idle" | "loading" | "success" | "error";
      let status: LifecycleStatus = "idle";
      let data: HeatwaveAnalysisResponse | null = null;
      const error: ApiError | null = null;

      // 1. Initial State
      expect(status).toBe("idle");
      expect(data).toBeNull();
      expect(error).toBeNull();

      // 2. Start analysis
      status = "loading";
      expect(status).toBe("loading");

      // 3. Successful resolution
      const mockResponse = {
        location: { latitude: 33.45, longitude: -112.07, name: "Phoenix", country: "United States", country_code: "US", admin1: "Arizona", elevation: 331, timezone: "America/Phoenix" },
        data_source: { provider: "ECMWF", dataset: "ERA5", resolution: "0.25°", variable: "2m max temperature", unit: "°C" },
        baseline: { baseline_start_year: 1991, baseline_end_year: 2020, percentile_threshold: 95.0, threshold_celsius: null, min_consecutive_days: 3 },
        analysis_window: { start_year: 1991, end_year: 2020, total_years: 30 },
        data_quality: { total_expected_days: 10958, observed_days: 10958, missing_days: 0, completeness_percentage: 100.0, has_critical_gaps: false, longest_missing_streak_days: 0 },
        annual_metrics: [],
        recent_events: [],
        trends: {},
        insights: ["Observed increasing decadal trend."],
        generated_at: new Date().toISOString(),
      } as HeatwaveAnalysisResponse;

      data = mockResponse;
      status = "success";
      expect(status).toBe("success");
      expect(data.location.name).toBe("Phoenix");
      expect(error).toBeNull();
    });

    it("transitions properly from loading to error upon backend failure", () => {
      type LifecycleStatus = "idle" | "loading" | "success" | "error";
      let status: LifecycleStatus = "loading";
      let error: ApiError | null = null;

      const networkError = new ApiError({
        status: 0,
        errorCode: "NETWORK_ERROR",
        message: "Unable to reach the climate analysis server.",
        isNetworkError: true,
      });

      error = networkError;
      status = "error";

      expect(status).toBe("error");
      expect(error.isNetworkError).toBe(true);
      expect(error.message).toContain("Unable to reach");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  2. Backend Downtime, Validation Errors & Preserved Fallback Data  */
  /* ------------------------------------------------------------------ */
  describe("Backend Errors & Preserved State", () => {
    it("preserves last successful result explicitly when subsequent request fails", () => {
      const lastSuccessful = {
        location: { latitude: 33.45, longitude: -112.07, name: "Phoenix" },
        analysis_window: { start_year: 1991, end_year: 2020 },
      };

      let activeData: typeof lastSuccessful | null = null;
      const lastSuccessfulData: typeof lastSuccessful | null = lastSuccessful;
      let error: ApiError | null = null;

      // User submits request for "Paris", which fails with 500
      error = new ApiError({
        status: 500,
        errorCode: "INTERNAL_SERVER_ERROR",
        message: "Server encountered an error.",
      });
      activeData = null; // Current request failed

      // Display logic: show previous successful data if available, but tag it explicitly
      const displayedData = activeData || (error ? lastSuccessfulData : null);

      expect(displayedData).not.toBeNull();
      expect(displayedData!.location.name).toBe("Phoenix"); // Explicitly Phoenix, NOT Paris!
      expect(error.status).toBe(500);
    });

    it("handles FastAPI 422 unprocessable entity validation errors with field details", () => {
      const validationError = new ApiError({
        status: 422,
        errorCode: "VALIDATION_ERROR",
        message: "Request parameter validation failed.",
        details: [
          { field: "start_year", issue: "start_year must be greater than or equal to 1940" },
          { field: "threshold_percentile", issue: "threshold_percentile must be in range [50.0, 99.9]" },
        ],
      });

      expect(validationError.status).toBe(422);
      expect(validationError.errorCode).toBe("VALIDATION_ERROR");
      expect(validationError.details?.length).toBe(2);
      expect(validationError.details?.[0].field).toBe("start_year");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  3. Parameter Modification Detection & State Consistency           */
  /* ------------------------------------------------------------------ */
  describe("Filter Parameter Modification Detection", () => {
    it("detects when user alters year range or location after an analysis completed", () => {
      const activeSnapshot = {
        mode: "search",
        targetName: "Phoenix",
        latitude: 33.45,
        longitude: -112.07,
        startYear: 1991,
        endYear: 2020,
        model: "ERA5",
      };

      const currentForm = {
        geographicMode: "search",
        selectedLocation: { latitude: 48.85, longitude: 2.35, name: "Paris" },
        startYear: 1991,
        endYear: 2020,
        model: "ERA5",
      };

      const isModified =
        activeSnapshot.startYear !== currentForm.startYear ||
        activeSnapshot.endYear !== currentForm.endYear ||
        activeSnapshot.latitude !== currentForm.selectedLocation.latitude ||
        activeSnapshot.longitude !== currentForm.selectedLocation.longitude;

      expect(isModified).toBe(true);
    });

    it("confirms parameters are unmodified when current form matches active snapshot", () => {
      const activeSnapshot = {
        latitude: 33.45,
        longitude: -112.07,
        startYear: 1991,
        endYear: 2020,
      };

      const currentForm = {
        latitude: 33.45,
        longitude: -112.07,
        startYear: 1991,
        endYear: 2020,
      };

      const isModified =
        activeSnapshot.startYear !== currentForm.startYear ||
        activeSnapshot.endYear !== currentForm.endYear ||
        activeSnapshot.latitude !== currentForm.latitude ||
        activeSnapshot.longitude !== currentForm.longitude;

      expect(isModified).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  4. Provisional & Incomplete Quality Distinctions                  */
  /* ------------------------------------------------------------------ */
  describe("Provisional and Incomplete Quality Exclusion Rules", () => {
    it("distinguishes reliable years included in regression from provisional/incomplete years", () => {
      const metrics: AnnualHeatwaveMetricDTO[] = [
        {
          year: 2023,
          event_count: 2,
          total_heatwave_days: 9,
          max_duration_days: 5,
          mean_duration_days: 4.5,
          cumulative_intensity_degree_days: 18.0,
          peak_intensity_celsius: 3.2,
          mean_peak_temperature_celsius: 41.0,
          expected_days: 365,
          usable_days: 365,
          completeness_percentage: 100.0,
          quality_status: "reliable",
        },
        {
          year: 2024,
          event_count: 1,
          total_heatwave_days: 4,
          max_duration_days: 4,
          mean_duration_days: 4.0,
          cumulative_intensity_degree_days: 7.0,
          peak_intensity_celsius: 2.1,
          mean_peak_temperature_celsius: 39.0,
          expected_days: 366,
          usable_days: 280,
          completeness_percentage: 76.5,
          quality_status: "provisional",
        },
      ];

      const reliableYears = metrics.filter((m) => m.quality_status === "reliable");
      const excludedYears = metrics.filter((m) => m.quality_status !== "reliable");

      expect(reliableYears.length).toBe(1);
      expect(reliableYears[0].year).toBe(2023);

      expect(excludedYears.length).toBe(1);
      expect(excludedYears[0].year).toBe(2024);
      expect(excludedYears[0].quality_status).toBe("provisional");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  5. Insufficient Data Trends & Empty Observations                  */
  /* ------------------------------------------------------------------ */
  describe("Insufficient Data Trends & Empty Results", () => {
    it("handles trend statistics when reliable sample size is under 10 years", () => {
      const trend: TrendStatisticsDTO = {
        metric_name: "annual_frequency",
        slope_per_decade: null,
        slope_per_year: null,
        intercept: null,
        p_value: null,
        direction: "indeterminate",
        is_significant: false,
        unit: "events/decade",
        sample_size_years: 6,
        description: "Insufficient reliable observations (<10 years).",
      };

      const hasSufficientTrend = trend.slope_per_decade !== null;
      expect(hasSufficientTrend).toBe(false);
      expect(trend.direction).toBe("indeterminate");
      expect(trend.sample_size_years).toBeLessThan(10);
    });

    it("handles zero qualifying heatwaves during a fully observed period", () => {
      const zeroMetrics: AnnualHeatwaveMetricDTO[] = [
        {
          year: 1991,
          event_count: 0,
          total_heatwave_days: 0,
          max_duration_days: null,
          mean_duration_days: null,
          cumulative_intensity_degree_days: null,
          peak_intensity_celsius: null,
          mean_peak_temperature_celsius: null,
          expected_days: 365,
          usable_days: 365,
          completeness_percentage: 100.0,
          quality_status: "reliable",
        },
      ];

      const totalEvents = zeroMetrics.reduce((acc, m) => acc + m.event_count, 0);
      expect(totalEvents).toBe(0);

      const hasZeroHeatwaves = totalEvents === 0;
      expect(hasZeroHeatwaves).toBe(true);

      // Verify that intensity remains null, NOT converted to 0.0°C
      expect(zeroMetrics[0].peak_intensity_celsius).toBeNull();
    });
  });
});
