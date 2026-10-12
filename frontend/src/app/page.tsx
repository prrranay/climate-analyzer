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
import { AlertTriangle, Info, MapPin, Compass } from "lucide-react";

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

  const handleLoadExample = async () => {
    if (isLoading) return;
    const preset = PRESET_REGIONS[0];
    setGeographicMode("search");
    setSelectedLocation(preset);

    const snapshot: QuerySnapshot = {
      mode: "search",
      targetName: preset.label,
      coordsLabel: `${preset.latitude.toFixed(4)}°, ${preset.longitude.toFixed(4)}°`,
      latitude: preset.latitude,
      longitude: preset.longitude,
      startYear: formState.startYear,
      endYear: formState.endYear,
      baselineStart: formState.baselineStartYear,
      baselineEnd: formState.baselineEndYear,
      percentile: formState.thresholdPercentile,
      minDays: formState.minConsecutiveDays,
      model: formState.model,
    };

    const res = await runPointAnalysis({
      latitude: preset.latitude,
      longitude: preset.longitude,
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#090D16] text-[#F8FAFC] flex flex-col font-sans selection:bg-[#F97316]/30 selection:text-[#FB923C] relative">
      {/* Spatial Grid Watermark Background Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#F97316_1px,transparent_1px)] [background-size:24px_24px] z-0" />

      {/* Global Navigation Shelf */}
      <Header />

      {/* Main Workspace Canvas */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-2 relative z-10 flex flex-col min-h-0 overflow-hidden">
        {/* Workspace Top Subheader Banner Shelf */}
        <div className="mb-3 pb-2 border-b border-[#1E293B] flex items-center justify-between text-xs font-mono text-[#94A3B8] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
              ANALYTICAL CANVAS
            </span>
            <span className="text-[#334155]">/</span>
            <span className="text-[#94A3B8]">Climatological Reanalysis View</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-[#64748B]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
              Grid Resolution: 28km (0.25°)
            </span>
            <span className="text-[#334155]">•</span>
            <span>Baseline: 1991–2020 ERA5 Climatology</span>
          </div>
        </div>

        {/* Dual Column Analytical Layout with Independent Internal Scroll Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Filter and Parameter Controls Rail */}
          <aside className="lg:col-span-4 w-full h-full bg-[#090D16] border border-[#334155] rounded-xl shadow-lg flex flex-col overflow-hidden min-h-0">
            {/* Top Meta Header inside Sidebar */}
            <div className="px-4 py-2.5 border-b border-[#1E293B] flex items-center justify-between shrink-0 bg-[#090D16]">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#F97316]" />
                <span className="text-[11px] font-semibold tracking-wider text-[#94A3B8] uppercase">
                  LOCATION QUERY
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#FB923C] bg-[#F97316]/10 px-1.5 py-0.5 rounded border border-[#F97316]/20 font-medium">
                0.25° Spatial Resolution
              </span>
            </div>

            {/* Parameter Body & Execution Controls */}
            <div className="flex-1 overflow-hidden p-3.5 flex flex-col min-h-0">
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
              >
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
              </AnalysisControls>
            </div>
          </aside>

          {/* Right Column: Dashboard Visualizations & Insights Canvas (Internal Scrolling) */}
          <section className="lg:col-span-8 w-full h-full flex flex-col overflow-y-auto custom-scrollbar min-h-0 pr-1 space-y-4">
            {/* Error Alert with Retry Action */}
            {error && (
              <ErrorAlert
                error={error}
                onRetry={handleRunAnalysis}
                className="shadow-sm"
              />
            )}

            {/* In-Flight Analysis Loading Indicator */}
            {isLoading && (
              <div className="p-8 sm:p-12 rounded-xl bg-[#0F172A] border border-[#334155] flex flex-col items-center justify-center space-y-3.5 shadow-xl relative overflow-hidden">
                <div className="absolute w-72 h-72 bg-[#F97316]/10 rounded-full blur-3xl pointer-events-none -top-10" />
                <LoadingSpinner
                  size="lg"
                  label={`Analyzing ${pendingTargetName} (${formState.startYear}–${formState.endYear})...`}
                />
                <div className="text-xs text-[#94A3B8] font-mono bg-[#090D16] p-2.5 rounded border border-[#1E293B] text-center max-w-md">
                  Source: {formState.model} • Baseline: {formState.baselineStartYear}–{formState.baselineEndYear} • Threshold: {formState.thresholdPercentile}th %ile • Min: {formState.minConsecutiveDays}d
                </div>
                <p className="text-xs text-[#64748B] max-w-sm text-center">
                  Computing calendar-day moving-window percentiles, extracting multi-day extreme anomalies, and executing OLS linear regressions.
                </p>
                <button
                  type="button"
                  onClick={cancel}
                  className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer mt-1"
                >
                  Cancel Analysis Request
                </button>
              </div>
            )}

            {/* Preserved Previous Result Notice when request fails */}
            {!isLoading && error && lastSuccessfulData && (
              <div className="p-3 rounded-lg bg-[#0F172A] border border-[#334155] text-xs text-[#94A3B8] flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#FB923C] shrink-0" />
                  <span>
                    Preserving last successful analysis for{" "}
                    <strong className="text-[#F8FAFC]">
                      {activeQuerySnapshot?.targetName ||
                        ("location" in lastSuccessfulData
                          ? lastSuccessfulData.location.name || "Custom Coordinate"
                          : "Regional Bounding Box")}{" "}
                      ({lastSuccessfulData.analysis_window.start_year}–{lastSuccessfulData.analysis_window.end_year})
                    </strong>.
                  </span>
                </div>
              </div>
            )}

            {/* Parameters Modified Warning Banner */}
            {!isLoading && isFiltersModified && activeQuerySnapshot && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-amber-300">Parameters modified:</span>
                    <p className="text-[#94A3B8] mt-0.5">
                      Displaying analysis for{" "}
                      <strong className="text-[#F8FAFC]">
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
                  className="px-3 py-1.5 rounded bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 text-white font-medium text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
                >
                  Update Analysis
                </button>
              </div>
            )}

            {/* Analysis Results Display */}
            {!isLoading && displayedData && (
              <div className="space-y-4">
                {/* Header Banner - Associated explicitly with analyzed dataset */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0F172A] border border-[#334155] shadow-sm">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#F97316] flex items-center gap-1.5 font-mono">
                      <MapPin className="w-3.5 h-3.5" />
                      Active Climatology Results
                    </span>
                    <h2 className="text-lg sm:text-xl font-bold text-[#F8FAFC] break-words">
                      {"location" in displayedData
                        ? (activeQuerySnapshot?.targetName || displayedData.location.name || "Custom Coordinate")
                        : (activeQuerySnapshot?.targetName || "Regional Bounding Box")}
                      {"location" in displayedData && displayedData.location.country && (
                        <span className="text-[#94A3B8] font-normal text-xs ml-2">
                          ({displayedData.location.admin1 ? `${displayedData.location.admin1}, ` : ""}
                          {displayedData.location.country})
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-[#64748B] font-mono mt-0.5">
                      {"location" in displayedData
                        ? `${displayedData.location.latitude.toFixed(4)}°, ${displayedData.location.longitude.toFixed(4)}° • Window: ${displayedData.analysis_window.start_year}–${displayedData.analysis_window.end_year}`
                        : `${displayedData.bounding_box.min_latitude.toFixed(2)}° to ${displayedData.bounding_box.max_latitude.toFixed(2)}° lat • Window: ${displayedData.analysis_window.start_year}–${displayedData.analysis_window.end_year}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-[#F97316]/10 text-[#FB923C] border border-[#F97316]/30 font-medium">
                      {displayedData.baseline.percentile_threshold}th %ile threshold
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#1E293B] text-[#94A3B8] border border-[#334155] font-mono">
                      {displayedData.data_source.dataset}
                    </span>
                    <ExportButton data={displayedData} />
                  </div>
                </div>

                {/* Key Summary Cards */}
                <SummaryStats data={displayedData} regionName={activeQuerySnapshot?.targetName} />

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
              <EmptyState onSelectPreset={handleLoadExample} />
            )}
          </section>
        </div>
      </main>

      {/* Global Telemetry Footer Shelf */}
      <Footer />
    </div>
  );
}
