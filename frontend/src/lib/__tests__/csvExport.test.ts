import { describe, it, expect } from "vitest";
import {
  escapeCsvValue,
  generateExportFilename,
  generateHeatwaveCsv,
} from "@/lib/csvExport";
import { HeatwaveAnalysisResponse, BoundingBoxHeatwaveAnalysisResponse } from "@/types/api";

describe("CSV Export Generation & Data Integrity", () => {
  /* ------------------------------------------------------------------ */
  /*  1. RFC 4180 Escaping & Null Preservation                         */
  /* ------------------------------------------------------------------ */
  describe("escapeCsvValue", () => {
    it("formats null and undefined as empty string (not 'null' or '0')", () => {
      expect(escapeCsvValue(null)).toBe("");
      expect(escapeCsvValue(undefined)).toBe("");
    });

    it("formats numeric zero as '0' without converting to empty string", () => {
      expect(escapeCsvValue(0)).toBe("0");
      expect(escapeCsvValue(0.0)).toBe("0");
    });

    it("escapes strings containing commas", () => {
      expect(escapeCsvValue("Phoenix, Arizona")).toBe('"Phoenix, Arizona"');
    });

    it("escapes strings containing double quotes according to RFC 4180", () => {
      expect(escapeCsvValue('Region "Valley"')).toBe('"Region ""Valley"""');
    });

    it("escapes strings containing newlines", () => {
      expect(escapeCsvValue("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  2. Export Filename Generation                                     */
  /* ------------------------------------------------------------------ */
  describe("generateExportFilename", () => {
    it("generates clean filenames identifying point location and year range", () => {
      const mockPointData = {
        location: { latitude: 33.45, longitude: -112.07, name: "Phoenix, USA" },
        analysis_window: { start_year: 1991, end_year: 2020 },
      } as unknown as HeatwaveAnalysisResponse;

      const filename = generateExportFilename(mockPointData);
      expect(filename).toBe("heatwave_climatology_phoenix_usa_1991_2020.csv");
    });

    it("generates filenames identifying bounding box coordinates and year range", () => {
      const mockBboxData = {
        bounding_box: {
          min_latitude: 32.5,
          max_latitude: 34.5,
          min_longitude: -113.0,
          max_longitude: -111.0,
        },
        analysis_window: { start_year: 1995, end_year: 2024 },
      } as unknown as BoundingBoxHeatwaveAnalysisResponse;

      const filename = generateExportFilename(mockBboxData);
      expect(filename).toBe("heatwave_bbox_32.50_34.50_-113.00_-111.00_1995_2024.csv");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  3. Full CSV Content Generation & Scientific Honesty               */
  /* ------------------------------------------------------------------ */
  describe("generateHeatwaveCsv", () => {
    const mockAnalysisResponse: HeatwaveAnalysisResponse = {
      location: {
        latitude: 33.4484,
        longitude: -112.074,
        name: "Phoenix",
        country: "United States",
        country_code: "US",
        admin1: "Arizona",
        elevation: 331,
        timezone: "America/Phoenix",
      },
      data_source: {
        provider: "ECMWF",
        dataset: "ERA5",
        resolution: "0.25°",
        variable: "2m daily max temp",
        unit: "°C",
      },
      baseline: {
        baseline_start_year: 1991,
        baseline_end_year: 2020,
        percentile_threshold: 95.0,
        threshold_celsius: null, // DOY moving window
        min_consecutive_days: 3,
      },
      analysis_window: {
        start_year: 2019,
        end_year: 2021,
        total_years: 3,
      },
      data_quality: {
        total_expected_days: 1096,
        observed_days: 1096,
        missing_days: 0,
        completeness_percentage: 100.0,
        has_critical_gaps: false,
        longest_missing_streak_days: 0,
      },
      annual_metrics: [
        {
          year: 2019,
          event_count: 2,
          total_heatwave_days: 8,
          max_duration_days: 5,
          mean_duration_days: 4.0,
          peak_intensity_celsius: 3.8,
          mean_peak_temperature_celsius: 42.5,
          cumulative_intensity_degree_days: 16.4,
          completeness_percentage: 100.0,
          usable_days: 365,
          expected_days: 365,
          quality_status: "reliable",
        },
        {
          // Genuine zero-event year: duration and intensity must be empty, NOT zero
          year: 2020,
          event_count: 0,
          total_heatwave_days: 0,
          max_duration_days: null,
          mean_duration_days: null,
          peak_intensity_celsius: null,
          mean_peak_temperature_celsius: null,
          cumulative_intensity_degree_days: null,
          completeness_percentage: 100.0,
          usable_days: 366,
          expected_days: 366,
          quality_status: "reliable",
        },
        {
          // Degraded observation year: must not fabricate data
          year: 2021,
          event_count: 1,
          total_heatwave_days: 3,
          max_duration_days: 3,
          mean_duration_days: 3.0,
          peak_intensity_celsius: 1.5,
          mean_peak_temperature_celsius: 38.0,
          cumulative_intensity_degree_days: 3.5,
          completeness_percentage: 65.0,
          usable_days: 237,
          expected_days: 365,
          quality_status: "incomplete",
        },
      ],
      recent_events: [],
      trends: {},
      insights: ["Test insight"],
      generated_at: "2026-10-12T01:00:00Z",
    };

    it("includes scientific metadata comment headers", () => {
      const csv = generateHeatwaveCsv(mockAnalysisResponse);

      expect(csv).toContain("# Climate Hazard Trend Analyzer - Heatwave Climatology Export");
      expect(csv).toContain("# Upstream Model Source: ECMWF ERA5 (0.25°)");
      expect(csv).toContain("# Climatological Baseline: 1991-2020 (WMO standard)");
      expect(csv).toContain("# Percentile Threshold: 95th percentile (Calendar-Day Moving Window)");
      expect(csv).toContain("# Geographic Target: Phoenix, Arizona, United States");
      expect(csv).toContain("# Analysis Period: 2019-2021 (3 years)");
    });

    it("includes standard column headers", () => {
      const csv = generateHeatwaveCsv(mockAnalysisResponse);
      const lines = csv.split("\n");
      const headerLine = lines.find((l) => l.startsWith("year,"));

      expect(headerLine).toBeDefined();
      expect(headerLine).toContain("event_count");
      expect(headerLine).toContain("total_heatwave_days");
      expect(headerLine).toContain("peak_excess_temperature_celsius");
      expect(headerLine).toContain("mean_peak_event_temperature_celsius");
      expect(headerLine).toContain("cumulative_intensity_degree_days");
      expect(headerLine).toContain("quality_status");
    });

    it("strictly preserves missing and null values as empty fields in zero-event years", () => {
      const csv = generateHeatwaveCsv(mockAnalysisResponse);
      const lines = csv.split("\n");
      const year2020Row = lines.find((l) => l.startsWith("2020,"));

      expect(year2020Row).toBeDefined();
      // Year 2020 had 0 events, 0 total days, and empty values for duration & intensity fields
      expect(year2020Row).toBe("2020,0,0,,,,,,100,366,366,reliable");
    });

    it("exports degraded years with their actual backend quality status", () => {
      const csv = generateHeatwaveCsv(mockAnalysisResponse);
      const lines = csv.split("\n");
      const year2021Row = lines.find((l) => l.startsWith("2021,"));

      expect(year2021Row).toBeDefined();
      expect(year2021Row).toContain("incomplete");
      expect(year2021Row).toContain("65"); // 65% completeness
    });
  });
});
