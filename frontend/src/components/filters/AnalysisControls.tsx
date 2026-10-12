"use client";

import React, { useState, useId } from "react";
import {
  Flame,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Square,
  AlertTriangle,
  Sliders,
  Snowflake,
  Droplets,
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
    <div className="space-y-4">
      {/* 1. Geographic Selection Mode Toggle */}
      <div>
        <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">
          GEOGRAPHIC SELECTION METHOD
        </label>
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#090D16] border border-[#334155] rounded text-xs">
          <button
            type="button"
            onClick={() => onGeographicModeChange("search")}
            disabled={isLoading}
            className={`py-1.5 px-2 text-center font-medium rounded transition-all cursor-pointer ${
              geographicMode === "search"
                ? "bg-[#1E293B] text-[#F8FAFC] border border-[#334155] shadow-inner"
                : "text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            City Search
          </button>
          <button
            type="button"
            onClick={() => onGeographicModeChange("coordinates")}
            disabled={isLoading}
            className={`py-1.5 px-2 text-center font-medium rounded transition-all cursor-pointer ${
              geographicMode === "coordinates"
                ? "bg-[#1E293B] text-[#F8FAFC] border border-[#334155] shadow-inner"
                : "text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            Direct Lat/Lon
          </button>
          <button
            type="button"
            onClick={() => onGeographicModeChange("bbox")}
            disabled={isLoading}
            className={`py-1.5 px-2 text-center font-medium rounded transition-all cursor-pointer ${
              geographicMode === "bbox"
                ? "bg-[#1E293B] text-[#F8FAFC] border border-[#334155] shadow-inner"
                : "text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            Bounding Box
          </button>
        </div>
      </div>

      {/* 2. Hazard Scope (Explicitly Heatwave Only) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
            HAZARD SELECTION
          </label>
          <span className="text-[10px] font-mono text-[#FB923C] font-medium">
            Release v1.0 Scope
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {HAZARDS.map((h) => {
            const isHeat = h.id === "heatwave";
            return (
              <div
                key={h.id}
                className={`p-3 rounded transition-all ${
                  h.active
                    ? "bg-[#F97316]/5 border border-[#F97316]/70 shadow-[0_0_12px_-2px_rgba(249,115,22,0.15)]"
                    : "bg-[#0F172A]/40 border border-[#1E293B] opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center ${
                        h.active
                          ? "bg-[#F97316] text-[#090D16]"
                          : "bg-[#1E293B] text-[#64748B]"
                      }`}
                    >
                      {isHeat ? (
                        <Flame className="w-3.5 h-3.5 fill-[#090D16]" />
                      ) : h.id === "cold_spell" ? (
                        <Snowflake className="w-3.5 h-3.5 text-[#06B6D4]" />
                      ) : (
                        <Droplets className="w-3.5 h-3.5 text-amber-300" />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-[#F8FAFC]">
                      {h.name}
                    </span>
                  </div>
                  {h.active ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#F97316]/20 text-[#FB923C] border border-[#F97316]/40 font-semibold uppercase">
                      ACTIVE CLIMATOLOGY
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1E293B] text-[#64748B] border border-[#1E293B]">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-[#94A3B8] leading-snug">
                  {h.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Analysis Period Range Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#F97316]" />
            <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              ANALYSIS PERIOD RANGE
            </label>
          </div>
          <span
            className={`text-[10px] font-mono ${
              isPeriodValid ? "text-[#94A3B8]" : "text-rose-400 font-semibold"
            }`}
          >
            {isPeriodValid ? `${spanYears} years` : "Invalid Range"} (Max: {MAX_ANALYSIS_RANGE_YEARS}y)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={startYearId} className="block text-[10px] font-mono text-[#64748B] mb-1">
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
              className={`w-full px-3 py-1.5 rounded bg-[#090D16] border text-xs text-[#F8FAFC] font-mono text-center outline-none transition-all ${
                isPeriodValid
                  ? "border-[#334155] focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
                  : "border-rose-500 text-rose-200"
              }`}
            />
          </div>
          <div>
            <label htmlFor={endYearId} className="block text-[10px] font-mono text-[#64748B] mb-1">
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
              className={`w-full px-3 py-1.5 rounded bg-[#090D16] border text-xs text-[#F8FAFC] font-mono text-center outline-none transition-all ${
                isPeriodValid
                  ? "border-[#334155] focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
                  : "border-rose-500 text-rose-200"
              }`}
            />
          </div>
        </div>

        {/* Validation Error Message */}
        {!isPeriodValid && (
          <div className="p-2 rounded bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span className="text-[11px]">
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
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
              formState.startYear === 1991 && formState.endYear === 2020
                ? "bg-[#1E293B] border border-[#F97316]/40 text-[#FB923C] font-semibold"
                : "bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            1991–2020 (WMO Standard)
          </button>
          <button
            type="button"
            onClick={() => onChange({ startYear: 1980, endYear: 2023 })}
            disabled={isLoading}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
              formState.startYear === 1980 && formState.endYear === 2023
                ? "bg-[#1E293B] border border-[#F97316]/40 text-[#FB923C] font-semibold"
                : "bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            1980–2023 (Modern Era)
          </button>
          <button
            type="button"
            onClick={() => onChange({ startYear: 1950, endYear: 2020 })}
            disabled={isLoading}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
              formState.startYear === 1950 && formState.endYear === 2020
                ? "bg-[#1E293B] border border-[#F97316]/40 text-[#FB923C] font-semibold"
                : "bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC]"
            }`}
          >
            1950–2020 (70y Trend)
          </button>
        </div>
      </div>

      {/* 4. Advanced Detection Parameters Accordion */}
      <div className="border border-[#334155] rounded bg-[#0F172A]/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[#1E293B]/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[#F97316]" />
            <span className="text-xs font-medium text-[#F8FAFC]">
              Detection Parameters &amp; Model
            </span>
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#64748B]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-3 border-t border-[#334155] space-y-3 bg-[#090D16]/60">
            {/* Climatological Baseline Period */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#94A3B8]">
                  Climatological Baseline
                </label>
                <span className="text-[10px] text-[#FB923C] font-mono">
                  {formState.baselineStartYear}–{formState.baselineEndYear}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="1940"
                  max={formState.baselineEndYear}
                  value={formState.baselineStartYear}
                  onChange={(e) =>
                    onChange({
                      baselineStartYear: parseInt(e.target.value) || DEFAULT_BASELINE_START,
                    })
                  }
                  disabled={isLoading}
                  className="px-2 py-1 rounded bg-[#090D16] border border-[#334155] text-xs text-[#F8FAFC] font-mono text-center outline-none focus:border-[#F97316]"
                />
                <input
                  type="number"
                  min={formState.baselineStartYear}
                  max="2026"
                  value={formState.baselineEndYear}
                  onChange={(e) =>
                    onChange({
                      baselineEndYear: parseInt(e.target.value) || DEFAULT_BASELINE_END,
                    })
                  }
                  disabled={isLoading}
                  className="px-2 py-1 rounded bg-[#090D16] border border-[#334155] text-xs text-[#F8FAFC] font-mono text-center outline-none focus:border-[#F97316]"
                />
              </div>
            </div>

            {/* Threshold Percentile */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#94A3B8]">
                  Threshold Percentile
                </label>
                <span className="text-xs text-[#FB923C] font-mono font-semibold">
                  {formState.thresholdPercentile}th %ile
                </span>
              </div>
              <input
                type="range"
                min="80"
                max="99"
                step="0.5"
                value={formState.thresholdPercentile}
                onChange={(e) =>
                  onChange({
                    thresholdPercentile: parseFloat(e.target.value) || DEFAULT_PERCENTILE,
                  })
                }
                disabled={isLoading}
                className="w-full accent-[#F97316] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#64748B] font-mono mt-0.5">
                <span>80% (Moderate)</span>
                <span>95% (Standard)</span>
                <span>99% (Rare)</span>
              </div>
            </div>

            {/* Min Consecutive Days */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#94A3B8]">
                  Min Consecutive Days
                </label>
                <span className="text-xs text-[#FB923C] font-mono font-semibold">
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
                className="w-full accent-[#F97316] cursor-pointer"
              />
            </div>

            {/* Reanalysis Model Dataset */}
            <div>
              <label className="block text-xs text-[#94A3B8] mb-1">
                Reanalysis Model Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ model: "ERA5" })}
                  disabled={isLoading}
                  className={`py-1.5 px-2 rounded text-xs border text-left cursor-pointer transition-colors ${
                    formState.model === "ERA5"
                      ? "bg-[#1E293B] border-[#F97316]/50 text-[#FB923C]"
                      : "bg-[#090D16] border-[#334155] text-[#94A3B8]"
                  }`}
                >
                  <div className="font-semibold">ERA5</div>
                  <div className="text-[10px] text-[#64748B]">0.25° Global</div>
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ model: "ERA5_LAND" })}
                  disabled={isLoading}
                  className={`py-1.5 px-2 rounded text-xs border text-left cursor-pointer transition-colors ${
                    formState.model === "ERA5_LAND"
                      ? "bg-[#1E293B] border-[#F97316]/50 text-[#FB923C]"
                      : "bg-[#090D16] border-[#334155] text-[#94A3B8]"
                  }`}
                >
                  <div className="font-semibold">ERA5-Land</div>
                  <div className="text-[10px] text-[#64748B]">0.1° Land</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Execution Controls */}
      <div className="pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isLoading || !isPeriodValid}
            className="flex-1 py-2.5 px-4 rounded font-semibold text-white bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:brightness-110 active:scale-[0.985] shadow-[0_0_16px_-2px_rgba(249,115,22,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 text-xs"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analyzing Climatology...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Run Heatwave Analysis</span>
              </>
            )}
          </button>

          {isLoading && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              title="Cancel analysis request"
              className="p-2.5 rounded border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-rose-300" />
            </button>
          )}

          <button
            type="button"
            onClick={onReset}
            title="Reset filters to default"
            disabled={isLoading}
            className="p-2.5 rounded bg-[#1E293B] border border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]/80 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {!canSubmit && !isLoading && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-[#94A3B8] bg-[#0F172A] p-2 rounded border border-[#334155]">
            <Info className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
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
