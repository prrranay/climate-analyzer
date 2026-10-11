"use client";

import React, { useState, useId } from "react";
import {
  Flame,
  Sliders,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Square,
  AlertTriangle,
} from "lucide-react";
import {
  MIN_ANALYSIS_YEAR,
  MAX_ANALYSIS_RANGE_YEARS,
  CURRENT_YEAR,
  DEFAULT_BASELINE_START,
  DEFAULT_BASELINE_END,
  DEFAULT_PERCENTILE,
  DEFAULT_MIN_CONSECUTIVE_DAYS,
  HAZARDS,
} from "@/lib/constants";

export type GeographicMode = "search" | "coordinates" | "bbox";

export interface AnalysisFormState {
  startYear: number;
  endYear: number;
  baselineStartYear: number;
  baselineEndYear: number;
  thresholdPercentile: number;
  minConsecutiveDays: number;
  model: "ERA5" | "ERA5_LAND";
}

interface AnalysisControlsProps {
  formState: AnalysisFormState;
  onChange: (updates: Partial<AnalysisFormState>) => void;
  onReset: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isLoading: boolean;
  canSubmit: boolean;
  geographicMode: GeographicMode;
  onGeographicModeChange: (mode: GeographicMode) => void;
}

export const AnalysisControls: React.FC<AnalysisControlsProps> = ({
  formState,
  onChange,
  onReset,
  onSubmit,
  onCancel,
  isLoading,
  canSubmit,
  geographicMode,
  onGeographicModeChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const startYearId = useId();
  const endYearId = useId();

  const spanYears = formState.endYear - formState.startYear + 1;
  const isSpanValid = spanYears > 0 && spanYears <= MAX_ANALYSIS_RANGE_YEARS;
  const isYearOrderValid = formState.startYear <= formState.endYear;
  const isMinYearValid = formState.startYear >= MIN_ANALYSIS_YEAR;
  const isMaxYearValid = formState.endYear <= CURRENT_YEAR;
  const isPeriodValid = isSpanValid && isYearOrderValid && isMinYearValid && isMaxYearValid;

  return (
    <div className="space-y-6">
      {/* 1. Geographic Selection Mode Toggle */}
      <div>
        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Geographic Selection Method
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => onGeographicModeChange("search")}
            disabled={isLoading}
            className={`py-2 px-2 text-center font-medium rounded-lg transition-all cursor-pointer ${
              geographicMode === "search"
                ? "bg-zinc-800 text-orange-400 shadow-sm border border-zinc-700/80"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            City Search
          </button>
          <button
            type="button"
            onClick={() => onGeographicModeChange("coordinates")}
            disabled={isLoading}
            className={`py-2 px-2 text-center font-medium rounded-lg transition-all cursor-pointer ${
              geographicMode === "coordinates"
                ? "bg-zinc-800 text-orange-400 shadow-sm border border-zinc-700/80"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Direct Lat/Lon
          </button>
          <button
            type="button"
            onClick={() => onGeographicModeChange("bbox")}
            disabled={isLoading}
            className={`py-2 px-2 text-center font-medium rounded-lg transition-all cursor-pointer ${
              geographicMode === "bbox"
                ? "bg-zinc-800 text-orange-400 shadow-sm border border-zinc-700/80"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Bounding Box
          </button>
        </div>
      </div>

      {/* 2. Hazard Scope (Explicitly Heatwave Only) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Hazard Selection
          </label>
          <span className="text-[11px] text-orange-400/90 font-medium">
            Release v1.0 Scope
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {HAZARDS.map((h) => (
            <div
              key={h.id}
              className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                h.active
                  ? "bg-orange-500/10 border-orange-500/40 text-orange-300 ring-1 ring-orange-500/20"
                  : "bg-zinc-900/30 border-zinc-800/60 text-zinc-500 opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Flame className={`w-4 h-4 ${h.active ? "text-orange-400" : "text-zinc-600"}`} />
                <div>
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                    {h.name}
                    {h.active && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        Active Climatology
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {h.description}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Analysis Period Range Controls (Default 1991–2020) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-orange-400" />
            Analysis Period Range
          </label>
          <span
            className={`text-[11px] font-mono ${
              isPeriodValid ? "text-zinc-400" : "text-rose-400 font-semibold"
            }`}
          >
            {isPeriodValid ? `${spanYears} years` : "Invalid Range"} (Max: {MAX_ANALYSIS_RANGE_YEARS}y)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={startYearId} className="block text-xs text-zinc-400 mb-1">
              Start Year (≥ {MIN_ANALYSIS_YEAR})
            </label>
            <input
              id={startYearId}
              type="number"
              min={MIN_ANALYSIS_YEAR}
              max={formState.endYear}
              value={formState.startYear}
              onChange={(e) =>
                onChange({ startYear: parseInt(e.target.value) || MIN_ANALYSIS_YEAR })
              }
              disabled={isLoading}
              className={`w-full px-3 py-2 rounded-lg bg-zinc-900 border text-sm text-zinc-100 font-mono focus:outline-none transition-all ${
                isPeriodValid
                  ? "border-zinc-700 focus:ring-1 focus:ring-orange-500"
                  : "border-rose-500 text-rose-200"
              }`}
            />
          </div>
          <div>
            <label htmlFor={endYearId} className="block text-xs text-zinc-400 mb-1">
              End Year (≤ {CURRENT_YEAR})
            </label>
            <input
              id={endYearId}
              type="number"
              min={formState.startYear}
              max={CURRENT_YEAR}
              value={formState.endYear}
              onChange={(e) =>
                onChange({ endYear: parseInt(e.target.value) || CURRENT_YEAR })
              }
              disabled={isLoading}
              className={`w-full px-3 py-2 rounded-lg bg-zinc-900 border text-sm text-zinc-100 font-mono focus:outline-none transition-all ${
                isPeriodValid
                  ? "border-zinc-700 focus:ring-1 focus:ring-orange-500"
                  : "border-rose-500 text-rose-200"
              }`}
            />
          </div>
        </div>

        {/* Validation Error Message */}
        {!isPeriodValid && (
          <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>
              {!isYearOrderValid
                ? "Start year cannot exceed end year."
                : !isMinYearValid
                ? `Start year cannot precede ERA5 historical origin (${MIN_ANALYSIS_YEAR}).`
                : !isMaxYearValid
                ? `End year cannot exceed current calendar year (${CURRENT_YEAR}).`
                : `Span of ${spanYears} years exceeds maximum allowable range of ${MAX_ANALYSIS_RANGE_YEARS} years.`}
            </span>
          </div>
        )}

        {/* Quick Range Presets */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => onChange({ startYear: 1991, endYear: 2020 })}
            disabled={isLoading}
            className="text-[11px] px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
          >
            1991–2020 (WMO Standard)
          </button>
          <button
            type="button"
            onClick={() => onChange({ startYear: 1980, endYear: 2023 })}
            disabled={isLoading}
            className="text-[11px] px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
          >
            1980–2023 (Modern Era)
          </button>
          <button
            type="button"
            onClick={() => onChange({ startYear: 1950, endYear: 2020 })}
            disabled={isLoading}
            className="text-[11px] px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
          >
            1950–2020 (70y Trend)
          </button>
        </div>
      </div>

      {/* 4. Advanced Climatology Accordion */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-zinc-300 hover:bg-zinc-800/50 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-orange-400" />
            Detection Parameters &amp; Reanalysis Model
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-4 border-t border-zinc-800 space-y-4 bg-zinc-950/60">
            {/* Baseline Period */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-300 font-medium">
                  Baseline Climatology Period
                </label>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {formState.baselineStartYear}–{formState.baselineEndYear}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1940}
                  max={2020}
                  value={formState.baselineStartYear}
                  onChange={(e) =>
                    onChange({
                      baselineStartYear: parseInt(e.target.value) || DEFAULT_BASELINE_START,
                    })
                  }
                  disabled={isLoading}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 font-mono"
                  placeholder="Baseline Start"
                />
                <input
                  type="number"
                  min={1950}
                  max={CURRENT_YEAR}
                  value={formState.baselineEndYear}
                  onChange={(e) =>
                    onChange({
                      baselineEndYear: parseInt(e.target.value) || DEFAULT_BASELINE_END,
                    })
                  }
                  disabled={isLoading}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 font-mono"
                  placeholder="Baseline End"
                />
              </div>
            </div>

            {/* Threshold Percentile */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-300 font-medium">
                  Percentile Threshold
                </label>
                <span className="text-xs text-orange-400 font-mono font-semibold">
                  {formState.thresholdPercentile}%
                </span>
              </div>
              <input
                type="range"
                min="80.0"
                max="99.9"
                step="0.5"
                value={formState.thresholdPercentile}
                onChange={(e) =>
                  onChange({ thresholdPercentile: parseFloat(e.target.value) || DEFAULT_PERCENTILE })
                }
                disabled={isLoading}
                className="w-full accent-orange-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-0.5">
                <span>80% (Moderate)</span>
                <span>95% (Standard Extreme)</span>
                <span>99% (Rare Extreme)</span>
              </div>
            </div>

            {/* Min Consecutive Days */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-300 font-medium">
                  Min Consecutive Days
                </label>
                <span className="text-xs text-orange-400 font-mono font-semibold">
                  {formState.minConsecutiveDays} days
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="14"
                step="1"
                value={formState.minConsecutiveDays}
                onChange={(e) =>
                  onChange({
                    minConsecutiveDays: parseInt(e.target.value) || DEFAULT_MIN_CONSECUTIVE_DAYS,
                  })
                }
                disabled={isLoading}
                className="w-full accent-orange-500 cursor-pointer"
              />
            </div>

            {/* Reanalysis Model Dataset */}
            <div>
              <label className="block text-xs text-zinc-300 font-medium mb-1">
                Reanalysis Model Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ model: "ERA5" })}
                  disabled={isLoading}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border text-left cursor-pointer ${
                    formState.model === "ERA5"
                      ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  }`}
                >
                  <div className="font-semibold">ERA5</div>
                  <div className="text-[10px] opacity-75">0.25° Global Atmosphere</div>
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ model: "ERA5_LAND" })}
                  disabled={isLoading}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border text-left cursor-pointer ${
                    formState.model === "ERA5_LAND"
                      ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  }`}
                >
                  <div className="font-semibold">ERA5-Land</div>
                  <div className="text-[10px] opacity-75">0.1° Enhanced Terrestrial</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Execution Controls */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isLoading || !isPeriodValid}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analyzing Climatology...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run Heatwave Analysis</span>
              </>
            )}
          </button>

          {isLoading && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              title="Cancel analysis request"
              className="py-3 px-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 transition-colors cursor-pointer"
            >
              <Square className="w-4 h-4 fill-rose-300" />
            </button>
          )}

          <button
            type="button"
            onClick={onReset}
            title="Reset filters to default"
            disabled={isLoading}
            className="p-3 rounded-xl border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {!canSubmit && !isLoading && (
          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
            <Info className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span>
              {geographicMode === "search"
                ? "Please search for and select a target city or region."
                : geographicMode === "coordinates"
                ? "Please enter valid latitude and longitude coordinates."
                : "Verify bounding box coordinates meet the area limit (≤ 25 deg²)."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
