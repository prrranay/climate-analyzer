"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Flame,
  Globe,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Activity,
  Sun,
  ShieldAlert,
  Loader2,
  XCircle,
} from "lucide-react";

export interface ClimateFact {
  id: string;
  category: string;
  title: string;
  fact: string;
  sourceNote?: string;
}

export const CLIMATE_FACTS: ClimateFact[] = [
  {
    id: "era5-reanalysis",
    category: "ECMWF ERA5 REANALYSIS",
    title: "24 Million Observations Daily",
    fact: "The ECMWF ERA5 reanalysis system assimilates over 24 million atmospheric, satellite, and oceanic observations every single day to reconstruct continuous global climate records back to 1940.",
    sourceNote: "Copernicus Climate Change Service",
  },
  {
    id: "heat-dome",
    category: "ATMOSPHERIC DYNAMICS",
    title: "The Omega-Block Heat Dome",
    fact: "Severe persistent heatwaves are often trapped by high-pressure atmospheric 'Omega-blocks'. These ridges act like convection oven lids, compressing sinking air and heating it adiabatically over several weeks.",
    sourceNote: "World Meteorological Organization",
  },
  {
    id: "urban-heat-island",
    category: "URBAN CLIMATOLOGY",
    title: "Nighttime Urban Heat Trapping",
    fact: "Dense urban cores can remain 4°C to 7°C warmer at night than surrounding rural areas. Asphalt and masonry release stored solar radiation slowly, depriving residents of physiological nocturnal relief.",
    sourceNote: "Global Urban Heat Observatory",
  },
  {
    id: "moving-window",
    category: "METHODOLOGY",
    title: "Calendar-Day Moving Baselines",
    fact: "Using a 31-day moving window centered on each calendar day ensures extreme thresholds account for natural seasonal progression, avoiding false anomalies during seasonal shoulder transitions.",
    sourceNote: "WMO Expert Team on Climate Change Detection and Indices",
  },
  {
    id: "wmo-normals",
    category: "CLIMATE NORMAL STANDARD",
    title: "30-Year Reference Climatology",
    fact: "The World Meteorological Organization benchmarks regional climate against standardized 30-year windows (like 1991–2020) to maintain statistically stable baselines against long-term secular warming trends.",
    sourceNote: "WMO Guidelines on Calculation of Climate Normals",
  },
  {
    id: "compound-persistence",
    category: "RUN-LENGTH SCIENCE",
    title: "Why Multi-Day Duration Matters",
    fact: "While single-day temperature spikes stress infrastructure, heatwaves persisting 3 or more consecutive days trigger non-linear health, agricultural, and power-grid compound risk due to cumulative thermal fatigue.",
    sourceNote: "Lancet Countdown on Health and Climate",
  },
  {
    id: "wet-bulb-limit",
    category: "PHYSIOLOGICAL LIMITS",
    title: "The 35°C Wet-Bulb Boundary",
    fact: "A wet-bulb temperature of 35°C represents the theoretical physiological limit of human heat tolerance. Above this point, metabolic cooling through sweat evaporation ceases to function regardless of hydration.",
    sourceNote: "Atmospheric & Environmental Health Science",
  },
  {
    id: "nighttime-acceleration",
    category: "DIURNAL ASYMMETRY",
    title: "Asymmetric Nighttime Warming",
    fact: "Across many global continents, nighttime minimum temperatures have risen significantly faster than daytime maximum temperatures over the past 50 years, disrupting natural plant and human recovery cycles.",
    sourceNote: "IPCC Sixth Assessment Report (AR6)",
  },
  {
    id: "grid-demand",
    category: "INFRASTRUCTURE IMPACT",
    title: "Power Grid Thermal Stress",
    fact: "A prolonged regional heatwave can boost metropolitan peak electricity demand by 15% to 30% for continuous refrigeration and cooling, while concurrently reducing power plant and transmission line efficiency.",
    sourceNote: "International Energy Agency (IEA)",
  },
  {
    id: "marine-coupling",
    category: "OCEAN-ATMOSPHERE",
    title: "Atmospheric-Marine Heat Coupling",
    fact: "Atmospheric heatwaves frequently trigger coupled marine heatwaves in adjacent coastal seas, doubling in frequency since the 1980s and threatening delicate coral reefs and coastal aquaculture.",
    sourceNote: "NOAA Marine Climatology",
  },
];

interface ProcessingStage {
  minSeconds: number;
  label: string;
  detail: string;
}

const PROCESSING_STAGES: ProcessingStage[] = [
  {
    minSeconds: 0,
    label: "Connecting to Open-Meteo Reanalysis",
    detail: "Resolving spatial coordinates and initializing historical ECMWF archive queries...",
  },
  {
    minSeconds: 4,
    label: "Ingesting Multi-Decadal Observations",
    detail: "Retrieving daily maximum temperature timeseries and verifying data quality completeness...",
  },
  {
    minSeconds: 9,
    label: "Synthesizing Calendar-Day Percentiles",
    detail: "Computing 31-day moving-window baseline thresholds and spatial grid aggregations...",
  },
  {
    minSeconds: 15,
    label: "Quantifying Trend Statistics",
    detail: "Detecting multi-day hazard streaks and executing ordinary least squares (OLS) regressions...",
  },
];

interface ClimateLoadingStateProps {
  targetName: string;
  startYear: number;
  endYear: number;
  model: string;
  baselineStartYear: number;
  baselineEndYear: number;
  thresholdPercentile: number;
  minConsecutiveDays: number;
  onCancel?: () => void;
  className?: string;
}

export const ClimateLoadingState: React.FC<ClimateLoadingStateProps> = ({
  targetName,
  startYear,
  endYear,
  model,
  baselineStartYear,
  baselineEndYear,
  thresholdPercentile,
  minConsecutiveDays,
  onCancel,
  className = "",
}) => {
  const [activeFactIndex, setActiveFactIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [factProgress, setFactProgress] = useState(0);

  const CYCLE_INTERVAL_MS = 6000;
  const TICK_INTERVAL_MS = 100;

  // Elapsed seconds timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fact auto-rotation with progress indicator
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setFactProgress((prev) => {
        const next = prev + (TICK_INTERVAL_MS / CYCLE_INTERVAL_MS) * 100;
        if (next >= 100) {
          setActiveFactIndex((curr) => (curr + 1) % CLIMATE_FACTS.length);
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isPaused, CLIMATE_FACTS.length]);

  const handleNextFact = useCallback(() => {
    setActiveFactIndex((curr) => (curr + 1) % CLIMATE_FACTS.length);
    setFactProgress(0);
  }, [CLIMATE_FACTS.length]);

  const handlePrevFact = useCallback(() => {
    setActiveFactIndex((curr) => (curr - 1 + CLIMATE_FACTS.length) % CLIMATE_FACTS.length);
    setFactProgress(0);
  }, [CLIMATE_FACTS.length]);

  const currentFact = CLIMATE_FACTS[activeFactIndex];

  // Dynamic pipeline stage based on elapsed time
  const currentStage = useMemo(() => {
    for (let i = PROCESSING_STAGES.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= PROCESSING_STAGES[i].minSeconds) {
        return PROCESSING_STAGES[i];
      }
    }
    return PROCESSING_STAGES[0];
  }, [elapsedSeconds]);

  // Format elapsed time MM:SS
  const formattedElapsed = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [elapsedSeconds]);

  return (
    <div
      className={`p-6 sm:p-8 rounded-xl bg-[#0F172A] border border-[#334155] flex flex-col items-center justify-center shadow-xl relative overflow-hidden transition-all duration-300 ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ambient gradient backdrops */}
      <div className="absolute w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -top-12 -right-12" />
      <div className="absolute w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -bottom-10 -left-10" />

      {/* Header Loading Status & Spinner */}
      <div className="w-full flex flex-col items-center text-center relative z-10 space-y-3">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shadow-inner">
            <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500" />
          </span>
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-100 flex items-center justify-center gap-2">
            <span>Analyzing {targetName}</span>
            <span className="text-orange-400 font-mono text-sm">
              ({startYear}–{endYear})
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-lg">
            {currentStage.detail}
          </p>
        </div>

        {/* Query parameters pill */}
        <div className="text-xs text-slate-400 font-mono bg-[#090D16] px-3.5 py-1.5 rounded-full border border-[#1E293B] text-center max-w-xl flex flex-wrap items-center justify-center gap-x-2 gap-y-1 shadow-sm">
          <span>Source: <strong className="text-slate-200">{model}</strong></span>
          <span className="text-slate-600">•</span>
          <span>Baseline: <strong className="text-slate-200">{baselineStartYear}–{baselineEndYear}</strong></span>
          <span className="text-slate-600">•</span>
          <span>Threshold: <strong className="text-slate-200">{thresholdPercentile}th %ile</strong></span>
          <span className="text-slate-600">•</span>
          <span>Min Run: <strong className="text-slate-200">{minConsecutiveDays}d</strong></span>
        </div>

        {/* Live Status & Elapsed Timer Tracker */}
        <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
          <div className="flex items-center gap-1.5 bg-[#1E293B]/70 px-2.5 py-1 rounded-md border border-[#334155]/60">
            <Activity className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
            <span className="text-slate-300 font-medium">{currentStage.label}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#1E293B]/70 px-2.5 py-1 rounded-md border border-[#334155]/60 font-mono">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Elapsed: <span className="text-slate-200 font-semibold">{formattedElapsed}</span></span>
          </div>
        </div>
      </div>

      {/* Climate Fact Carousel Card */}
      <div className="w-full max-w-2xl mt-6 relative z-10">
        <div className="bg-[#090D16]/90 border border-slate-700/60 rounded-xl p-4 sm:p-5 relative shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-orange-500/40">
          {/* Header of Fact card */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-wider font-semibold uppercase text-orange-400/90 block">
                  {currentFact.category}
                </span>
                <span className="text-xs text-slate-400">Did you know?</span>
              </div>
            </div>

            {/* Fact navigation controls & counter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-slate-500 pr-1">
                {activeFactIndex + 1}/{CLIMATE_FACTS.length}
              </span>
              <button
                type="button"
                onClick={handlePrevFact}
                title="Previous fact"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                aria-label="Previous fact"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextFact}
                title="Next fact"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                aria-label="Next fact"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fact Content */}
          <div className="min-h-[70px] flex flex-col justify-center">
            <h4 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              {currentFact.title}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentFact.fact}
            </p>
          </div>

          {/* Footer note & auto-rotation progress bar */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="italic truncate">
              {currentFact.sourceNote ? `Ref: ${currentFact.sourceNote}` : "Peer-reviewed climatological science"}
            </span>
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
              {isPaused ? "Paused on hover" : "Auto-rotating insights"}
            </span>
          </div>

          {/* Progress bar tracking next fact rotation */}
          <div className="w-full bg-slate-800 h-0.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-gradient-to-r from-orange-500 to-cyan-500 h-full transition-all duration-100 ease-linear"
              style={{ width: `${factProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cancel analysis action */}
      {onCancel && (
        <div className="mt-5 relative z-10 flex flex-col items-center">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:underline cursor-pointer transition-colors px-3 py-1.5 rounded-md hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel Analysis Request
          </button>
        </div>
      )}
    </div>
  );
};
