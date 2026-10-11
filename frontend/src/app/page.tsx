"use client";

import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RegionSearch } from "@/components/filters/RegionSearch";
import { CoordinateInput } from "@/components/filters/CoordinateInput";
import { BoundingBoxInput, BoundingBoxValues } from "@/components/filters/BoundingBoxInput";
import {
  AnalysisControls,
  AnalysisFormState,
  GeographicMode,
} from "@/components/filters/AnalysisControls";
import { SummaryStats } from "@/components/dashboard/SummaryStats";
import { DataQualityBanner } from "@/components/dashboard/DataQualityBanner";
import { AnnualFrequencyChart } from "@/components/charts/AnnualFrequencyChart";
import { HeatwaveDurationChart } from "@/components/charts/HeatwaveDurationChart";
import { HeatwaveIntensityChart } from "@/components/charts/HeatwaveIntensityChart";
import { TrendSummaryPanel } from "@/components/dashboard/TrendSummaryPanel";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { RecentEventsTable } from "@/components/dashboard/RecentEventsTable";
import { BaselineMetadataCard } from "@/components/dashboard/BaselineMetadataCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { useHeatwaveAnalysis } from "@/hooks/useHeatwaveAnalysis";
import { GeoLocationDTO } from "@/types/api";
import {
  DEFAULT_START_YEAR,
  DEFAULT_END_YEAR,
  DEFAULT_BASELINE_START,
  DEFAULT_BASELINE_END,
  DEFAULT_PERCENTILE,
  DEFAULT_MIN_CONSECUTIVE_DAYS,
  DEFAULT_MODEL,
  PRESET_REGIONS,
} from "@/lib/constants";

export default function Home() {
  const [geographicMode, setGeographicMode] = useState<GeographicMode>("search");
  const [selectedLocation, setSelectedLocation] = useState<GeoLocationDTO | null>(PRESET_REGIONS[0]); // default to Phoenix, USA

  const [bboxValues, setBboxValues] = useState<BoundingBoxValues>({
    min_lat: 32.5,
    max_lat: 34.5,
    min_lon: -113.0,
    max_lon: -111.0,
  });

  const [formState, setFormState] = useState<AnalysisFormState>({
    startYear: DEFAULT_START_YEAR,
    endYear: DEFAULT_END_YEAR,
    baselineStartYear: DEFAULT_BASELINE_START,
    baselineEndYear: DEFAULT_BASELINE_END,
    thresholdPercentile: DEFAULT_PERCENTILE,
    minConsecutiveDays: DEFAULT_MIN_CONSECUTIVE_DAYS,
    model: DEFAULT_MODEL,
  });

  const {
    data,
    isLoading,
    error,
    runPointAnalysis,
    runBboxAnalysis,
    cancel,
    clear,
  } = useHeatwaveAnalysis();

  const handleUpdateForm = (updates: Partial<AnalysisFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  };

  const handleReset = () => {
    clear();
    setFormState({
      startYear: DEFAULT_START_YEAR,
      endYear: DEFAULT_END_YEAR,
      baselineStartYear: DEFAULT_BASELINE_START,
      baselineEndYear: DEFAULT_BASELINE_END,
      thresholdPercentile: DEFAULT_PERCENTILE,
      minConsecutiveDays: DEFAULT_MIN_CONSECUTIVE_DAYS,
      model: DEFAULT_MODEL,
    });
  };

  const handleRunAnalysis = () => {
    if (isLoading) return;

    if (geographicMode === "bbox") {
      runBboxAnalysis({
        min_lat: bboxValues.min_lat,
        max_lat: bboxValues.max_lat,
        min_lon: bboxValues.min_lon,
        max_lon: bboxValues.max_lon,
        start_year: formState.startYear,
        end_year: formState.endYear,
        baseline_start_year: formState.baselineStartYear,
        baseline_end_year: formState.baselineEndYear,
        threshold_percentile: formState.thresholdPercentile,
        min_consecutive_days: formState.minConsecutiveDays,
        model: formState.model,
      });
    } else {
      if (!selectedLocation) return;
      runPointAnalysis({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        start_year: formState.startYear,
        end_year: formState.endYear,
        baseline_start_year: formState.baselineStartYear,
        baseline_end_year: formState.baselineEndYear,
        threshold_percentile: formState.thresholdPercentile,
        min_consecutive_days: formState.minConsecutiveDays,
        model: formState.model,
      });
    }
  };

  const isBboxValid =
    bboxValues.min_lat >= -90 &&
    bboxValues.max_lat <= 90 &&
    bboxValues.min_lon >= -180 &&
    bboxValues.max_lon <= 180 &&
    bboxValues.min_lat < bboxValues.max_lat &&
    bboxValues.min_lon < bboxValues.max_lon &&
    (bboxValues.max_lat - bboxValues.min_lat) * (bboxValues.max_lon - bboxValues.min_lon) <= 25.0;

  const isPointValid =
    selectedLocation !== null &&
    selectedLocation.latitude >= -90 &&
    selectedLocation.latitude <= 90 &&
    selectedLocation.longitude >= -180 &&
    selectedLocation.longitude <= 180;

  const canSubmit = geographicMode === "bbox" ? isBboxValid : isPointValid;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-orange-500/30 selection:text-orange-200">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Filter and Parameter Controls */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-6 bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800/80 backdrop-blur-md shadow-xl">
            {geographicMode === "search" && (
              <RegionSearch
                selectedLocation={selectedLocation}
                onSelectLocation={(loc) => setSelectedLocation(loc)}
                disabled={isLoading}
              />
            )}

            {geographicMode === "coordinates" && (
              <CoordinateInput
                location={selectedLocation}
                onChangeLocation={(loc) => setSelectedLocation(loc)}
                disabled={isLoading}
              />
            )}

            {geographicMode === "bbox" && (
              <BoundingBoxInput
                values={bboxValues}
                onChange={setBboxValues}
                disabled={isLoading}
              />
            )}

            <AnalysisControls
              formState={formState}
              onChange={handleUpdateForm}
              onReset={handleReset}
              onSubmit={handleRunAnalysis}
              onCancel={cancel}
              isLoading={isLoading}
              canSubmit={canSubmit}
              geographicMode={geographicMode}
              onGeographicModeChange={setGeographicMode}
            />
          </aside>

          {/* Right Column: Dashboard Visualizations & Insights */}
          <section className="lg:col-span-8 space-y-6">
            {/* Error Message */}
            {error && (
              <ErrorAlert error={error} onRetry={handleRunAnalysis} />
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="p-16 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 backdrop-blur-md flex flex-col items-center justify-center space-y-4">
                <LoadingSpinner
                  size="lg"
                  label={`Fetching ERA5 meteorological reanalysis (${formState.startYear}–${formState.endYear})...`}
                />
                <p className="text-xs text-zinc-500 max-w-sm text-center">
                  Deriving moving-window 95th-percentile thresholds, evaluating multi-day extreme anomalies, and executing OLS linear regressions.
                </p>
                <button
                  type="button"
                  onClick={cancel}
                  className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer mt-2"
                >
                  Cancel Request
                </button>
              </div>
            )}

            {/* Analysis Results Display */}
            {!isLoading && data && (
              <div className="space-y-6 animate-fadeIn">
                {/* Location / Region Badge Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-orange-400">
                      Active Climatology Analysis
                    </span>
                    <h2 className="text-xl font-bold text-zinc-100">
                      {"location" in data
                        ? data.location.name || "Custom Coordinate"
                        : "Regional Bounding Box"}
                      {"location" in data && data.location.country && (
                        <span className="text-zinc-400 font-normal text-sm ml-2">
                          ({data.location.admin1 ? `${data.location.admin1}, ` : ""}
                          {data.location.country})
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      {"location" in data
                        ? `${data.location.latitude.toFixed(4)}°, ${data.location.longitude.toFixed(4)}° • ${data.analysis_window.start_year}–${data.analysis_window.end_year}`
                        : `${data.bounding_box.min_latitude.toFixed(2)}° to ${data.bounding_box.max_latitude.toFixed(2)}° lat • ${data.analysis_window.start_year}–${data.analysis_window.end_year}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                      {data.baseline.percentile_threshold}th %ile threshold
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                      {data.data_source.dataset}
                    </span>
                  </div>
                </div>

                {/* Key Summary Cards */}
                <SummaryStats data={data} />

                {/* Data Quality & Completeness Banner */}
                <DataQualityBanner
                  dataQuality={data.data_quality}
                  annualMetrics={data.annual_metrics}
                />

                {/* Annual Heatwave Event Frequency Time-Series Chart */}
                <AnnualFrequencyChart
                  metrics={data.annual_metrics}
                  frequencyTrend={data.trends["annual_frequency"]}
                />

                {/* Heatwave Duration (Days) Chart */}
                <HeatwaveDurationChart
                  metrics={data.annual_metrics}
                  durationTrend={data.trends["heatwave_days"]}
                />

                {/* Heatwave Intensity & Thermal Exceedance Chart */}
                <HeatwaveIntensityChart
                  metrics={data.annual_metrics}
                  intensityTrend={data.trends["cumulative_intensity"]}
                />

                {/* Linear Regression Statistical Trends */}
                <TrendSummaryPanel trends={data.trends} />

                {/* Backend Generated Insights */}
                <InsightsPanel insights={data.insights} />

                {/* Recent Heatwave Events Log */}
                <RecentEventsTable events={data.recent_events} />

                {/* Methodology & Data Source Metadata */}
                <BaselineMetadataCard data={data} />
              </div>
            )}

            {/* Empty State when no analysis has run */}
            {!isLoading && !data && !error && (
              <EmptyState
                onSelectPreset={() => {
                  setGeographicMode("search");
                  setSelectedLocation(PRESET_REGIONS[0]);
                  handleRunAnalysis();
                }}
              />
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
