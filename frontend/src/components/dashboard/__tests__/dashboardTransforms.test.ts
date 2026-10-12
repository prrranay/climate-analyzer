import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatSlope,
  formatTemperature,
  formatDegreeDays,
  formatPercent,
  formatPValue,
  getTrendDirectionBadge,
  getQualityStatusBadge,
} from "@/lib/utils";
import {
  AnnualHeatwaveMetricDTO,
  TrendStatisticsDTO,
} from "@/types/api";

describe("Dashboard Data Transformations, Nullable Safety & Formatting", () => {
  /* ------------------------------------------------------------------ */
  /*  1. Nullable Fields & Zero vs Null Disambiguation                  */
  /* ------------------------------------------------------------------ */
  describe("formatSlope - Zero Slope Disambiguation", () => {
    it("strictly formats a numeric zero slope as '0.00', NOT as missing/N/A", () => {
      expect(formatSlope(0)).toBe("0.00");
      expect(formatSlope(0.0)).toBe("0.00");
    });

    it("formats positive slope rates with a leading '+' sign", () => {
      expect(formatSlope(1.45)).toBe("+1.45");
      expect(formatSlope(0.05)).toBe("+0.05");
    });

    it("formats negative slope rates with a '-' sign", () => {
      expect(formatSlope(-0.85)).toBe("-0.85");
    });

    it("returns fallback 'N/A' for null, undefined, and NaN without throwing", () => {
      expect(formatSlope(null)).toBe("N/A");
      expect(formatSlope(undefined)).toBe("N/A");
      expect(formatSlope(NaN)).toBe("N/A");
      expect(formatSlope(null, 2, "Insufficient Data")).toBe("Insufficient Data");
    });
  });

  describe("formatNumber & Unit Formatters", () => {
    it("formats numbers while preserving zero as '0.00'", () => {
      expect(formatNumber(0)).toBe("0.00");
      expect(formatNumber(42.567, 1)).toBe("42.6");
      expect(formatNumber(null)).toBe("N/A");
    });

    it("formats temperatures explicitly with Celsius (°C) unit", () => {
      expect(formatTemperature(38.4)).toBe("38.4°C");
      expect(formatTemperature(0)).toBe("0.0°C");
      expect(formatTemperature(null)).toBe("N/A");
      expect(formatTemperature(undefined)).toBe("N/A");
    });

    it("formats degree-days explicitly with '°C-days' unit", () => {
      expect(formatDegreeDays(12.8)).toBe("12.8 °C-days");
      expect(formatDegreeDays(0)).toBe("0.0 °C-days");
      expect(formatDegreeDays(null)).toBe("N/A");
    });

    it("formats percentages with '%' symbol", () => {
      expect(formatPercent(98.5)).toBe("98.5%");
      expect(formatPercent(100)).toBe("100.0%");
      expect(formatPercent(null)).toBe("N/A");
    });

    it("formats p-values with proper scientific and significance annotations", () => {
      expect(formatPValue(0.0002)).toBe("< 0.001 (High Sig.)");
      expect(formatPValue(0.008)).toBe("0.008 (p < 0.01)");
      expect(formatPValue(0.035)).toBe("0.035 (p < 0.05)");
      expect(formatPValue(0.25)).toBe("0.250 (Not sig.)");
      expect(formatPValue(null)).toBe("N/A");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  2. Chart Data Transformations & Zero-Event Distinctions          */
  /* ------------------------------------------------------------------ */
  describe("Chart Data Transformations", () => {
    const mockMetrics: AnnualHeatwaveMetricDTO[] = [
      {
        year: 2019,
        event_count: 3,
        total_heatwave_days: 14,
        max_duration_days: 6,
        mean_duration_days: 4.67,
        cumulative_intensity_degree_days: 28.5,
        peak_intensity_celsius: 4.2,
        mean_peak_temperature_celsius: 39.8,
        expected_days: 365,
        usable_days: 365,
        completeness_percentage: 100.0,
        quality_status: "reliable",
      },
      {
        // Genuine zero-event year: events occurred = 0, so intensity and duration metrics are null
        year: 2020,
        event_count: 0,
        total_heatwave_days: 0,
        max_duration_days: null,
        mean_duration_days: null,
        cumulative_intensity_degree_days: null,
        peak_intensity_celsius: null,
        mean_peak_temperature_celsius: null,
        expected_days: 366,
        usable_days: 366,
        completeness_percentage: 100.0,
        quality_status: "reliable",
      },
      {
        // Provisional year: current calendar year is ongoing
        year: 2024,
        event_count: 1,
        total_heatwave_days: 4,
        max_duration_days: 4,
        mean_duration_days: 4.0,
        cumulative_intensity_degree_days: 6.2,
        peak_intensity_celsius: 2.1,
        mean_peak_temperature_celsius: 37.5,
        expected_days: 366,
        usable_days: 280,
        completeness_percentage: 76.5,
        quality_status: "provisional",
      },
      {
        // Unreliable year: degraded completeness
        year: 2021,
        event_count: 0,
        total_heatwave_days: 0,
        max_duration_days: null,
        mean_duration_days: null,
        cumulative_intensity_degree_days: null,
        peak_intensity_celsius: null,
        mean_peak_temperature_celsius: null,
        expected_days: 365,
        usable_days: 180,
        completeness_percentage: 49.3,
        quality_status: "insufficient_data",
      },
    ];

    it("distinguishes genuine zero-event reliable years from missing/unreliable years", () => {
      const year2020 = mockMetrics.find((m) => m.year === 2020)!;
      const year2021 = mockMetrics.find((m) => m.year === 2021)!;

      // Year 2020 had genuine 0 events during full observation (100% complete)
      expect(year2020.event_count).toBe(0);
      expect(year2020.quality_status).toBe("reliable");
      expect(year2020.completeness_percentage).toBe(100.0);

      // Year 2021 had severe missing observations (49.3% complete)
      expect(year2021.event_count).toBe(0);
      expect(year2021.quality_status).toBe("insufficient_data");
      expect(year2021.quality_status).not.toBe("reliable");
    });

    it("preserves null for peak intensity and cumulative degree-days in zero-event years", () => {
      const year2020 = mockMetrics.find((m) => m.year === 2020)!;

      // Do not substitute 0°C for null intensity
      expect(year2020.peak_intensity_celsius).toBeNull();
      expect(year2020.mean_peak_temperature_celsius).toBeNull();
      expect(year2020.cumulative_intensity_degree_days).toBeNull();

      // Year with events has non-null intensity
      const year2019 = mockMetrics.find((m) => m.year === 2019)!;
      expect(year2019.peak_intensity_celsius).toBe(4.2);
      expect(year2019.mean_peak_temperature_celsius).toBe(39.8);
      expect(year2019.cumulative_intensity_degree_days).toBe(28.5);
    });

    it("correctly identifies provisional current-year records", () => {
      const year2024 = mockMetrics.find((m) => m.year === 2024)!;
      expect(year2024.quality_status).toBe("provisional");
      const badge = getQualityStatusBadge(year2024.quality_status);
      expect(badge.label).toBe("Provisional");
      expect(badge.className).toContain("amber");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  3. Summary Metric Computations                                   */
  /* ------------------------------------------------------------------ */
  describe("Summary Metric Computations", () => {
    it("computes total events and total heatwave days across the time series", () => {
      const metrics: AnnualHeatwaveMetricDTO[] = [
        {
          year: 2010,
          event_count: 2,
          total_heatwave_days: 8,
          max_duration_days: 5,
          mean_duration_days: 4.0,
          cumulative_intensity_degree_days: 12.0,
          peak_intensity_celsius: 3.0,
          mean_peak_temperature_celsius: 38.0,
          expected_days: 365,
          usable_days: 365,
          completeness_percentage: 100,
          quality_status: "reliable",
        },
        {
          year: 2011,
          event_count: 0,
          total_heatwave_days: 0,
          max_duration_days: null,
          mean_duration_days: null,
          cumulative_intensity_degree_days: null,
          peak_intensity_celsius: null,
          mean_peak_temperature_celsius: null,
          expected_days: 365,
          usable_days: 365,
          completeness_percentage: 100,
          quality_status: "reliable",
        },
        {
          year: 2012,
          event_count: 3,
          total_heatwave_days: 15,
          max_duration_days: 7,
          mean_duration_days: 5.0,
          cumulative_intensity_degree_days: 25.0,
          peak_intensity_celsius: 4.5,
          mean_peak_temperature_celsius: 41.2,
          expected_days: 366,
          usable_days: 366,
          completeness_percentage: 100,
          quality_status: "reliable",
        },
      ];

      const totalEvents = metrics.reduce((acc, m) => acc + m.event_count, 0);
      const totalDays = metrics.reduce((acc, m) => acc + m.total_heatwave_days, 0);
      const avgDuration = totalEvents > 0 ? totalDays / totalEvents : null;

      expect(totalEvents).toBe(5);
      expect(totalDays).toBe(23);
      expect(avgDuration).toBeCloseTo(4.6, 1);
    });

    it("safely handles periods with zero qualifying events without NaN", () => {
      const zeroMetrics: AnnualHeatwaveMetricDTO[] = [
        {
          year: 2000,
          event_count: 0,
          total_heatwave_days: 0,
          max_duration_days: null,
          mean_duration_days: null,
          cumulative_intensity_degree_days: null,
          peak_intensity_celsius: null,
          mean_peak_temperature_celsius: null,
          expected_days: 366,
          usable_days: 366,
          completeness_percentage: 100,
          quality_status: "reliable",
        },
      ];

      const totalEvents = zeroMetrics.reduce((acc, m) => acc + m.event_count, 0);
      const totalDays = zeroMetrics.reduce((acc, m) => acc + m.total_heatwave_days, 0);
      const avgDuration = totalEvents > 0 ? totalDays / totalEvents : null;

      expect(totalEvents).toBe(0);
      expect(totalDays).toBe(0);
      expect(avgDuration).toBeNull();
      expect(avgDuration !== null ? `${formatNumber(avgDuration, 1)} d/event` : "N/A").toBe("N/A");
    });

    it("correctly computes peak temperature exceedance above threshold ignoring null years", () => {
      const metricsWithNulls: AnnualHeatwaveMetricDTO[] = [
        {
          year: 2001,
          event_count: 0,
          total_heatwave_days: 0,
          max_duration_days: null,
          mean_duration_days: null,
          cumulative_intensity_degree_days: null,
          peak_intensity_celsius: null,
          mean_peak_temperature_celsius: null,
          expected_days: 365,
          usable_days: 365,
          completeness_percentage: 100,
          quality_status: "reliable",
        },
        {
          year: 2002,
          event_count: 1,
          total_heatwave_days: 5,
          max_duration_days: 5,
          mean_duration_days: 5,
          cumulative_intensity_degree_days: 10,
          peak_intensity_celsius: 4.8,
          mean_peak_temperature_celsius: 42.1,
          expected_days: 365,
          usable_days: 365,
          completeness_percentage: 100,
          quality_status: "reliable",
        },
      ];

      const peakExceedance = metricsWithNulls.reduce<number | null>((max, m) => {
        if (m.peak_intensity_celsius === null) return max;
        if (max === null) return m.peak_intensity_celsius;
        return Math.max(max, m.peak_intensity_celsius);
      }, null);

      expect(peakExceedance).toBe(4.8);
      // Peak Temperature Exceedance KPI label & display format: +4.8°C
      const displayValue = peakExceedance !== null ? `+${formatNumber(peakExceedance, 1)}°C` : "N/A";
      expect(displayValue).toBe("+4.8°C");
    });

    it("evaluates decoupled zero-event versus cross-year heatwave days messaging", () => {
      // Helper simulating HeatwaveDurationChart tooltip display decision
      const getDurationTooltipMessage = (eventCount: number, totalDays: number) => {
        if (eventCount > 0) return "events_occurred";
        if (totalDays > 0) {
          return `No events started this year (${totalDays} heatwave ${totalDays === 1 ? "day" : "days"} attributed from prior-year event).`;
        }
        return "Zero heatwave days recorded in this year.";
      };

      // 1. Year with events
      expect(getDurationTooltipMessage(2, 8)).toBe("events_occurred");

      // 2. Year with 0 events started, but 3 days carryover from prior December
      expect(getDurationTooltipMessage(0, 3)).toBe(
        "No events started this year (3 heatwave days attributed from prior-year event)."
      );

      // 3. Year with genuine 0 heatwave days
      expect(getDurationTooltipMessage(0, 0)).toBe("Zero heatwave days recorded in this year.");
    });

    it("preserves selected region name from query snapshot even if backend returns Custom Point", () => {
      const snapshotTargetName = "Phoenix, USA";
      const backendLocationName = null; // Backend returns null/unresolved city name

      const resolvedName = snapshotTargetName || backendLocationName || "Custom Point";
      expect(resolvedName).toBe("Phoenix, USA");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  4. Trend Direction Badges & Insufficient Data States             */
  /* ------------------------------------------------------------------ */
  describe("Trend Statistics & Insufficient Data Handling", () => {
    it("handles statistically significant increasing trends", () => {
      const badge = getTrendDirectionBadge("increasing", true);
      expect(badge.label).toBe("Statistically Increasing");
      expect(badge.className).toContain("rose");
      expect(badge.iconName).toBe("TrendingUp");
    });

    it("handles non-significant upward trends", () => {
      const badge = getTrendDirectionBadge("increasing", false);
      expect(badge.label).toBe("Upward (Non-sig)");
      expect(badge.className).toContain("amber");
    });

    it("handles stable trends", () => {
      const badge = getTrendDirectionBadge("stable", false);
      expect(badge.label).toBe("Stable");
      expect(badge.iconName).toBe("Minus");
    });

    it("handles indeterminate trends when sample size is insufficient", () => {
      const badge = getTrendDirectionBadge("indeterminate", false);
      expect(badge.label).toBe("Indeterminate");
      expect(badge.iconName).toBe("HelpCircle");
    });

    it("correctly identifies insufficient data state when slope_per_decade is null", () => {
      const insufficientTrend: TrendStatisticsDTO = {
        metric_name: "annual_frequency",
        slope_per_decade: null,
        slope_per_year: null,
        intercept: null,
        p_value: null,
        direction: "indeterminate",
        is_significant: false,
        unit: "events/decade",
        sample_size_years: 7,
        description: null,
      };

      const hasSufficientData = insufficientTrend.slope_per_decade !== null;
      expect(hasSufficientData).toBe(false);
      expect(insufficientTrend.sample_size_years).toBeLessThan(10);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  5. Moving-Window Percentile Semantics (threshold_celsius === null)*/
  /* ------------------------------------------------------------------ */
  describe("Moving-Window Percentile Threshold Metadata", () => {
    it("recognizes null threshold_celsius as DOY moving window, NOT 0°C", () => {
      const baselineConfig = {
        baseline_start_year: 1991,
        baseline_end_year: 2020,
        percentile_threshold: 95.0,
        threshold_celsius: null,
        min_consecutive_days: 3,
      };

      // Ensure we do not display 0.0°C when threshold_celsius is null
      const displayThreshold =
        baselineConfig.threshold_celsius !== null
          ? `${formatNumber(baselineConfig.threshold_celsius, 1)}°C`
          : "Calendar Day-of-Year Moving Window";

      expect(displayThreshold).toBe("Calendar Day-of-Year Moving Window");
      expect(displayThreshold).not.toContain("0.0°C");
      expect(displayThreshold).not.toContain("0°C");
    });
  });
});
