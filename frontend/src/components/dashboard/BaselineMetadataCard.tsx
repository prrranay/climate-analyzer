"use client";

import React, { useState } from "react";
import {
  Database,
  Sliders,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { HeatwaveAnalysisResponse, BoundingBoxHeatwaveAnalysisResponse } from "@/types/api";
import { isBoundingBoxResult } from "@/hooks/useHeatwaveAnalysis";
import { formatNumber, formatPercent } from "@/lib/utils";

interface BaselineMetadataCardProps {
  data: HeatwaveAnalysisResponse | BoundingBoxHeatwaveAnalysisResponse;
}

export const BaselineMetadataCard: React.FC<BaselineMetadataCardProps> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data_source, baseline, analysis_window, data_quality, generated_at } = data;
  const isBbox = isBoundingBoxResult(data);

  return (
    <div className="rounded-xl bg-[#0F172A] border border-[#334155] overflow-hidden transition-all shadow-sm">
      {/* Header with Expand/Collapse toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-[#1E293B]/30 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-[#F97316] shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-[#F8FAFC] flex items-center gap-2">
              Climatological Methodology &amp; Data Quality Information
            </h3>
            <p className="text-[13px] text-[#CBD5E1] mt-0.5">
              Reanalysis specifications, moving-window percentile definitions, baseline window &amp; observation integrity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-[#94A3B8] font-mono hidden sm:inline">
            Run: {new Date(generated_at).toLocaleString()}
          </span>
          <div className="p-1.5 rounded bg-[#1E293B] text-[#CBD5E1] hover:text-[#F8FAFC]">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expandable Content Body */}
      {isExpanded && (
        <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-[#334155]">
          {/* Methodological Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-3.5">
            {/* 1. Weather Source & Model */}
            <div className="p-3.5 rounded-lg bg-[#090D16] border border-[#1E293B] space-y-1.5">
              <div className="font-semibold text-[#F8FAFC] flex items-center gap-1.5 text-[13px]">
                <Database className="w-3.5 h-3.5 text-[#F97316]" />
                Weather Model &amp; Source
              </div>
              <div className="space-y-1 text-[#E2E8F0] font-mono text-xs">
                <div>
                  <span className="text-[#94A3B8]">Dataset:</span> {data_source.dataset}
                </div>
                <div>
                  <span className="text-[#94A3B8]">Provider:</span> {data_source.provider}
                </div>
                <div>
                  <span className="text-[#94A3B8]">Resolution:</span> {data_source.resolution}
                </div>
                <div>
                  <span className="text-[#94A3B8]">Variable:</span> {data_source.variable} ({data_source.unit})
                </div>
              </div>
            </div>

            {/* 2. Climatological Baseline & Heatwave Definition */}
            <div className="p-3.5 rounded-lg bg-[#090D16] border border-[#1E293B] space-y-1.5">
              <div className="font-semibold text-[#F8FAFC] flex items-center gap-1.5 text-[13px]">
                <Sliders className="w-3.5 h-3.5 text-[#FB923C]" />
                Heatwave Definition
              </div>
              <div className="space-y-1 text-[#E2E8F0] font-mono text-xs">
                <div>
                  <span className="text-[#94A3B8]">Baseline:</span> {baseline.baseline_start_year}–{baseline.baseline_end_year}
                </div>
                <div>
                  <span className="text-[#94A3B8]">Threshold:</span> {baseline.percentile_threshold}th percentile
                </div>
                <div>
                  <span className="text-[#94A3B8]">Min Duration:</span> &ge; {baseline.min_consecutive_days} consecutive days
                </div>
                <div>
                  <span className="text-[#94A3B8]">Scope:</span> Daily max temperature
                </div>
              </div>
            </div>

            {/* 3. Percentile Threshold Method */}
            <div className="p-3.5 rounded-lg bg-[#090D16] border border-[#1E293B] space-y-1.5">
              <div className="font-semibold text-[#F8FAFC] flex items-center gap-1.5 text-[13px]">
                <Info className="w-3.5 h-3.5 text-[#06B6D4]" />
                Threshold Calculation
              </div>
              <div className="space-y-1 text-[#E2E8F0] font-mono text-xs">
                <div>
                  <span className="text-[#94A3B8]">Method:</span> DOY Moving-Window
                </div>
                <div>
                  <span className="text-[#94A3B8]">Threshold:</span>{" "}
                  {baseline.threshold_celsius !== null
                    ? `${formatNumber(baseline.threshold_celsius, 1)}°C`
                    : "Calendar-day adaptive"}
                </div>
                <div className="text-xs text-[#94A3B8] pt-1 font-sans leading-relaxed">
                  Threshold varies across all 365 calendar days to account for seasonal variations.
                </div>
              </div>
            </div>

            {/* 4. Temporal Availability & Quality Diagnostics */}
            <div className="p-3.5 rounded-lg bg-[#090D16] border border-[#1E293B] space-y-1.5">
              <div className="font-semibold text-[#F8FAFC] flex items-center gap-1.5 text-[13px]">
                <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
                Data Availability &amp; Quality
              </div>
              <div className="space-y-1 text-[#E2E8F0] font-mono text-xs">
                <div>
                  <span className="text-[#94A3B8]">Window:</span> {analysis_window.start_year}–{analysis_window.end_year} ({analysis_window.total_years}y)
                </div>
                <div>
                  <span className="text-[#94A3B8]">Observed:</span> {data_quality.observed_days.toLocaleString()} / {data_quality.total_expected_days.toLocaleString()}
                </div>
                <div>
                  <span className="text-[#94A3B8]">Missing:</span> {data_quality.missing_days} ({formatPercent(100 - data_quality.completeness_percentage, 1)})
                </div>
                <div>
                  <span className="text-[#94A3B8]">Completeness:</span> {formatPercent(data_quality.completeness_percentage, 1)}
                </div>
              </div>
            </div>
          </div>

          {/* Spatial Grid Sampling (if bbox) */}
          {isBbox && (
            <div className="p-3.5 rounded-lg bg-[#090D16] border border-[#1E293B] space-y-1.5 text-xs">
              <div className="font-semibold text-[#F8FAFC] flex items-center gap-1.5 text-[13px]">
                <Layers className="w-3.5 h-3.5 text-[#94A3B8]" />
                Spatial Grid Sampling &amp; Bounding Box Details
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs text-[#E2E8F0]">
                <div>
                  <span className="text-[#94A3B8]">Grid Points:</span> {data.spatial_sampling.grid_points_count} points
                </div>
                <div>
                  <span className="text-[#94A3B8]">Area:</span> {formatNumber(data.bounding_box.area_square_degrees, 2)} deg²
                </div>
                <div>
                  <span className="text-[#94A3B8]">Aggregation:</span> {data.spatial_sampling.spatial_aggregation_method}
                </div>
                <div>
                  <span className="text-[#94A3B8]">Completeness:</span> {formatNumber(data.spatial_sampling.spatial_completeness_percentage, 1)}%
                </div>
              </div>
              {data.spatial_sampling.disclaimer && (
                <p className="text-xs text-[#CBD5E1] pt-1 font-sans leading-relaxed">
                  {data.spatial_sampling.disclaimer}
                </p>
              )}
            </div>
          )}

          {/* Detailed Climatological Explanatory Note */}
          <div className="p-4 rounded-lg bg-[#090D16] border border-[#1E293B] text-[13px] text-[#CBD5E1] space-y-2 leading-relaxed">
            <div className="font-semibold text-[#F8FAFC] flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              Methodological Standards &amp; Quality Limitations
            </div>
            <p>
              <strong className="text-[#F8FAFC]">Percentile-Threshold Methodology:</strong> The backend computes percentiles on a calendar-day moving window
              centered on each day of the year across the {baseline.baseline_start_year}–{baseline.baseline_end_year} climatological
              baseline period. Because the threshold adapts to the seasonal cycle, a heatwave represents an anomaly relative to the
              expected local temperatures for that specific calendar day, rather than a single static temperature throughout the year.
            </p>
            <p>
              <strong className="text-[#F8FAFC]">Data Quality &amp; Regression Integrity:</strong> OLS linear trend regressions are computed exclusively over
              climatologically reliable years. Incomplete years with severe missing observations and the current calendar year (provisional)
              are excluded from trend estimation to prevent distortion. A minimum of 10 reliable observation years is required for statistical
              significance testing.
            </p>
            {data_quality.has_critical_gaps && (
              <div className="flex items-center gap-2 text-amber-200 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/30 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Observation dataset contains critical missing streaks (longest streak: {data_quality.longest_missing_streak_days} days).
                  Metrics for affected years should be interpreted with caution.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
