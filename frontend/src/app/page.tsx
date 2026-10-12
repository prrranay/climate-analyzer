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
import { ExportButton } from "@/components/dashboard/ExportButton";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";
import { useHeatwaveAnalysis, AnalysisResult } from "@/hooks/useHeatwaveAnalysis";
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
import { AlertTriangle, Info, MapPin } from "lucide-react";

interface QuerySnapshot {
  mode: GeographicMode;
  targetName: string;
  coordsLabel: string;
  latitude?: number;
  longitude?: number;
  bbox?: BoundingBoxValues;
  startYear: number;
  endYear: number;
  baselineStart: number;
  baselineEnd: number;
  percentile: number;
  minDays: number;
  model: string;
}

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

  // Track the exact query parameters corresponding to the currently rendered dataset
  const [activeQuerySnapshot, setActiveQuerySnapshot] = useState<QuerySnapshot | null>(null);

  const {
    data,
    lastSuccessfulData,
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
    setActiveQuerySnapshot(null);
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

  const handleRunAnalysis = async () => {
    if (isLoading) return;

    if (geographicMode === "bbox") {
      const targetName = "Regional Bounding Box";
      const coordsLabel = `${bboxValues.min_lat.toFixed(2)}° to ${bboxValues.max_lat.toFixed(2)}° lat, ${bboxValues.min_lon.toFixed(2)}° to ${bboxValues.max_lon.toFixed(2)}° lon`;

      const snapshot: QuerySnapshot = {
        mode: "bbox",
        targetName,
        coordsLabel,
        bbox: { ...bboxValues },
        startYear: formState.startYear,
        endYear: formState.endYear,
        baselineStart: formState.baselineStartYear,
        baselineEnd: formState.baselineEndYear,
        percentile: formState.thresholdPercentile,
        minDays: formState.minConsecutiveDays,
        model: formState.model,
      };

      const res = await runBboxAnalysis({
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

      if (res) {
        setActiveQuerySnapshot(snapshot);
      }
    } else {
      if (!selectedLocation) return;
      const targetName = selectedLocation.name || "Custom Coordinate";
      const coordsLabel = `${selectedLocation.latitude.toFixed(4)}°, ${selectedLocation.longitude.toFixed(4)}°`;

      const snapshot: QuerySnapshot = {
        mode: geographicMode,
        targetName,
        coordsLabel,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        startYear: formState.startYear,
        endYear: formState.endYear,
        baselineStart: formState.baselineStartYear,
        baselineEnd: formState.baselineEndYear,
        percentile: formState.thresholdPercentile,
        minDays: formState.minConsecutiveDays,
        model: formState.model,
      };

      const res = await runPointAnalysis({
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

      if (res) {
        setActiveQuerySnapshot(snapshot);
      }
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

  // Preserve last successful result if error occurs, keeping its association explicit
  const displayedData: AnalysisResult | null = data || (error ? lastSuccessfulData : null);

  // Check if current filter inputs differ from what is currently displayed
  const isFiltersModified = Boolean(
    displayedData &&
    activeQuerySnapshot &&
    (
      activeQuerySnapshot.mode !== geographicMode ||
      activeQuerySnapshot.startYear !== formState.startYear ||
      activeQuerySnapshot.endYear !== formState.endYear ||
      activeQuerySnapshot.baselineStart !== formState.baselineStartYear ||
      activeQuerySnapshot.baselineEnd !== formState.baselineEndYear ||
      activeQuerySnapshot.percentile !== formState.thresholdPercentile ||
      activeQuerySnapshot.minDays !== formState.minConsecutiveDays ||
      activeQuerySnapshot.model !== formState.model ||
      (geographicMode === "search" && selectedLocation && (
        selectedLocation.latitude !== activeQuerySnapshot.latitude ||
        selectedLocation.longitude !== activeQuerySnapshot.longitude
      )) ||
      (geographicMode === "coordinates" && selectedLocation && (
        selectedLocation.latitude !== activeQuerySnapshot.latitude ||
        selectedLocation.longitude !== activeQuerySnapshot.longitude
      )) ||
      (geographicMode === "bbox" && (
        bboxValues.min_lat !== activeQuerySnapshot.bbox?.min_lat ||
        bboxValues.max_lat !== activeQuerySnapshot.bbox?.max_lat ||
        bboxValues.min_lon !== activeQuerySnapshot.bbox?.min_lon ||
        bboxValues.max_lon !== activeQuerySnapshot.bbox?.max_lon
      ))
    )
  );

  // Human-readable pending parameter label for loading card
  const pendingTargetName =
    geographicMode === "bbox"
      ? "Bounding Box"
      : selectedLocation?.name || `${selectedLocation?.latitude.toFixed(2)}°, ${selectedLocation?.longitude.toFixed(2)}°`;

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
            {/* Error Message with Recovery Action */}
            {error && (
              <ErrorAlert
                error={error}
                onRetry={handleRunAnalysis}
                className="shadow-lg"
              />
            )}

            {/* In-Flight Analysis Loading Indicator */}
            {isLoading && (
              <div className="p-12 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md flex flex-col items-center justify-center space-y-4 shadow-xl">
                <LoadingSpinner
                  size="lg"
                  label={`Analyzing ${pendingTargetName} (${formState.startYear}–${formState.endYear})...`}
                />
                <div className="text-xs text-zinc-400 font-mono bg-zinc-950/70 p-2.5 rounded-lg border border-zinc-800/80 text-center max-w-md">
                  Source: {formState.model} • Baseline: {formState.baselineStartYear}–{formState.baselineEndYear} • Threshold: {formState.thresholdPercentile}th %ile • Min: {formState.minConsecutiveDays}d
                </div>
                <p className="text-xs text-zinc-500 max-w-sm text-center">
                  Computing calendar-day moving-window percentiles, extracting multi-day extreme anomalies, and executing OLS linear regressions.
                </p>
                <button
                  type="button"
                  onClick={cancel}
                  className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded px-1"
                >
                  Cancel Analysis Request
                </button>
              </div>
            )}

            {/* Preserved Previous Result Notice when request fails */}
            {!isLoading && error && lastSuccessfulData && (
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-xs text-zinc-300 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>
                    Preserving last successful analysis for{" "}
                    <strong className="text-zinc-100">
                      {"location" in lastSuccessfulData
                        ? lastSuccessfulData.location.name || "Custom Coordinate"
                        : "Regional Bounding Box"}{" "}
                      ({lastSuccessfulData.analysis_window.start_year}–{lastSuccessfulData.analysis_window.end_year})
                    </strong>.
                  </span>
                </div>
              </div>
            )}

            {/* Parameters Modified Warning Banner */}
            {!isLoading && isFiltersModified && activeQuerySnapshot && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-amber-300">Parameters modified:</span>
                    <p className="text-zinc-300 mt-0.5">
                      Displaying analysis for{" "}
                      <strong className="text-zinc-100">
                        {activeQuerySnapshot.targetName} ({activeQuerySnapshot.startYear}–{activeQuerySnapshot.endYear})
                      </strong>.
                      Click <em>Run Heatwave Analysis</em> to evaluate your new selection.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isLoading || !canSubmit}
                  className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium text-xs transition-colors shrink-0 cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  Update Analysis
                </button>
              </div>
            )}

            {/* Analysis Results Display */}
            {!isLoading && displayedData && (
              <div className="space-y-6 animate-fadeIn">
                {/* Header Banner - Always associated explicitly with analyzed dataset */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-orange-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Active Climatology Results
                    </span>
                    <h2 className="text-xl font-bold text-zinc-100 break-words">
                      {"location" in displayedData
                        ? displayedData.location.name || "Custom Coordinate"
                        : "Regional Bounding Box"}
                      {"location" in displayedData && displayedData.location.country && (
                        <span className="text-zinc-400 font-normal text-sm ml-2">
                          ({displayedData.location.admin1 ? `${displayedData.location.admin1}, ` : ""}
                          {displayedData.location.country})
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      {"location" in displayedData
                        ? `${displayedData.location.latitude.toFixed(4)}°, ${displayedData.location.longitude.toFixed(4)}° • Analysis Window: ${displayedData.analysis_window.start_year}–${displayedData.analysis_window.end_year}`
                        : `${displayedData.bounding_box.min_latitude.toFixed(2)}° to ${displayedData.bounding_box.max_latitude.toFixed(2)}° lat • Analysis Window: ${displayedData.analysis_window.start_year}–${displayedData.analysis_window.end_year}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                      {displayedData.baseline.percentile_threshold}th %ile threshold
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                      {displayedData.data_source.dataset}
                    </span>
                    <ExportButton data={displayedData} />
                  </div>
                </div>

                {/* Key Summary Cards */}
                <SummaryStats data={displayedData} />

                {/* Data Quality & Completeness Diagnostics Banner */}
                <DataQualityBanner
                  dataQuality={displayedData.data_quality}
                  annualMetrics={displayedData.annual_metrics}
                />

                {/* Annual Heatwave Event Frequency Time-Series Chart */}
                <AnnualFrequencyChart
                  metrics={displayedData.annual_metrics}
                  frequencyTrend={displayedData.trends["annual_frequency"]}
                />

                {/* Heatwave Duration (Days) Chart */}
                <HeatwaveDurationChart
                  metrics={displayedData.annual_metrics}
                  durationTrend={displayedData.trends["heatwave_days"]}
                />

                {/* Heatwave Intensity & Thermal Exceedance Chart */}
                <HeatwaveIntensityChart
                  metrics={displayedData.annual_metrics}
                  intensityTrend={displayedData.trends["cumulative_intensity"]}
                />

                {/* Linear Regression Statistical Trends */}
                <TrendSummaryPanel trends={displayedData.trends} />

                {/* Backend Generated Insights */}
                <InsightsPanel insights={displayedData.insights} />

                {/* Recent Heatwave Events Log */}
                <RecentEventsTable events={displayedData.recent_events} />

                {/* Methodology & Data Source Metadata */}
                <BaselineMetadataCard data={displayedData} />
              </div>
            )}

            {/* Empty State when no analysis has run */}
            {!isLoading && !displayedData && !error && (
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
