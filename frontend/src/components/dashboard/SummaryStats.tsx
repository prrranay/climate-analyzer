import React from "react";
import { Flame, TrendingUp, Zap, Clock, ShieldCheck, MapPin, Calendar } from "lucide-react";
import { HeatwaveAnalysisResponse, BoundingBoxHeatwaveAnalysisResponse } from "@/types/api";
import { isBoundingBoxResult } from "@/hooks/useHeatwaveAnalysis";
import { formatNumber, formatSlope, formatPercent, getTrendDirectionBadge } from "@/lib/utils";

interface SummaryStatsProps {
  data: HeatwaveAnalysisResponse | BoundingBoxHeatwaveAnalysisResponse;
}

export const SummaryStats: React.FC<SummaryStatsProps> = ({ data }) => {
  const { annual_metrics, trends, data_quality, analysis_window } = data;
  const isBbox = isBoundingBoxResult(data);

  // 1. Total qualifying heatwave events across the requested period
  const totalEvents = annual_metrics.reduce((acc, m) => acc + m.event_count, 0);

  // 2. Total heatwave days
  const totalHeatwaveDays = annual_metrics.reduce((acc, m) => acc + m.total_heatwave_days, 0);

  // 3. Average event duration across years where events occurred
  const avgEventDuration = totalEvents > 0 ? totalHeatwaveDays / totalEvents : null;

  // 4. Peak recorded temperature across all years
  const peakTemp = annual_metrics.reduce<number | null>((max, m) => {
    if (m.peak_intensity_celsius === null) return max;
    if (max === null) return m.peak_intensity_celsius;
    return Math.max(max, m.peak_intensity_celsius);
  }, null);

  // 5. Heatwave frequency trend and its units
  const freqTrend = trends["annual_frequency"];
  const freqBadge = freqTrend
    ? getTrendDirectionBadge(freqTrend.direction, freqTrend.is_significant)
    : null;

  // 6. Region label
  const regionLabel = isBbox
    ? `Bounding Box (${data.bounding_box.min_latitude.toFixed(2)}° to ${data.bounding_box.max_latitude.toFixed(2)}° lat, ${data.bounding_box.min_longitude.toFixed(2)}° to ${data.bounding_box.max_longitude.toFixed(2)}° lon)`
    : `${data.location.name || "Custom Point"}${data.location.country ? `, ${data.location.country}` : ""}`;

  return (
    <div className="space-y-4">
      {/* Scope Header Card: Region & Analysis Period */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
          <div>
            <div className="text-xs uppercase font-semibold text-zinc-400 tracking-wider">
              Analyzed Geographic Target
            </div>
            <div className="text-sm font-bold text-zinc-100">{regionLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Calendar className="w-3.5 h-3.5 text-orange-400" />
            <span>
              Period: {analysis_window.start_year}–{analysis_window.end_year} ({analysis_window.total_years} years)
            </span>
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Events */}
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Heatwaves</span>
            <Flame className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-100 font-mono">
            {totalEvents}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            <span>{totalEvents === 0 ? "No qualifying events" : "Qualifying heatwave events"}</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-orange-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Total Heatwave Days & Average Duration */}
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Extreme Heat Days</span>
            <Clock className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-100 font-mono">
            {totalHeatwaveDays}
            <span className="text-xs font-normal text-zinc-400 ml-1">days</span>
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            <span>
              Avg duration:{" "}
              <strong className="text-zinc-200 font-mono">
                {avgEventDuration !== null ? `${formatNumber(avgEventDuration, 1)} d/event` : "N/A"}
              </strong>
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Heatwave Trend & Units */}
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Frequency Trend</span>
            <TrendingUp className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-100 font-mono flex items-baseline gap-1">
            {freqTrend?.slope_per_decade !== null && freqTrend?.slope_per_decade !== undefined ? (
              <>
                <span>{formatSlope(freqTrend.slope_per_decade, 2)}</span>
                <span className="text-xs font-sans font-normal text-zinc-400">
                  {freqTrend.unit || "events/dec"}
                </span>
              </>
            ) : (
              <span className="text-base text-zinc-400">N/A (Insufficient Data)</span>
            )}
          </div>
          <div className="text-xs mt-1">
            {freqBadge ? (
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${freqBadge.className}`}
              >
                {freqBadge.label}
              </span>
            ) : (
              <span className="text-zinc-500 text-[10px]">OLS Regression</span>
            )}
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Peak Temp & Quality */}
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md relative overflow-hidden group">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Max Recorded Temp</span>
            <Zap className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-zinc-100 font-mono">
            {peakTemp !== null ? `${formatNumber(peakTemp, 1)}°C` : "N/A"}
          </div>
          <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{formatPercent(data_quality.completeness_percentage)} completeness</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-yellow-500/10 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
