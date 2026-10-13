import React from "react";
import { Flame, TrendingUp, Thermometer, Clock, ShieldCheck, MapPin, Calendar } from "lucide-react";
import { HeatwaveAnalysisResponse, BoundingBoxHeatwaveAnalysisResponse } from "@/types/api";
import { isBoundingBoxResult } from "@/hooks/useHeatwaveAnalysis";
import { formatNumber, formatSlope, formatPercent, getTrendDirectionBadge } from "@/lib/utils";

interface SummaryStatsProps {
  data: HeatwaveAnalysisResponse | BoundingBoxHeatwaveAnalysisResponse;
  regionName?: string;
}

export const SummaryStats: React.FC<SummaryStatsProps> = ({ data, regionName }) => {
  const { annual_metrics, trends, data_quality, analysis_window } = data;
  const isBbox = isBoundingBoxResult(data);

  // 1. Total qualifying heatwave events across the requested period
  const totalEvents = annual_metrics.reduce((acc, m) => acc + m.event_count, 0);

  // 2. Total heatwave days
  const totalHeatwaveDays = annual_metrics.reduce((acc, m) => acc + m.total_heatwave_days, 0);

  // 3. Average event duration across years where events occurred
  const avgEventDuration = totalEvents > 0 ? totalHeatwaveDays / totalEvents : null;

  // 4. Peak temperature exceedance above threshold across all years
  const peakExceedance = annual_metrics.reduce<number | null>((max, m) => {
    if (m.peak_intensity_celsius === null) return max;
    if (max === null) return m.peak_intensity_celsius;
    return Math.max(max, m.peak_intensity_celsius);
  }, null);

  // 5. Heatwave frequency trend and its units
  const freqTrend = trends["annual_frequency"];
  const freqBadge = freqTrend
    ? getTrendDirectionBadge(freqTrend.direction, freqTrend.is_significant)
    : null;

  // 6. Region label (using the query snapshot name associated with the successful result)
  const resolvedTargetName = regionName || (!isBbox ? data.location.name : null);
  const regionLabel = isBbox
    ? `Bounding Box (${data.bounding_box.min_latitude.toFixed(2)}° to ${data.bounding_box.max_latitude.toFixed(2)}° lat, ${data.bounding_box.min_longitude.toFixed(2)}° to ${data.bounding_box.max_longitude.toFixed(2)}° lon)`
    : `${resolvedTargetName || "Custom Point"}${data.location.country && (!resolvedTargetName || !resolvedTargetName.includes(data.location.country)) ? `, ${data.location.country}` : ""}`;

  return (
    <div className="space-y-3.5">
      {/* Scope Header Card: Region & Analysis Period */}
      <div className="p-3.5 rounded-xl bg-[#0F172A] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-[#F97316] shrink-0" />
          <div>
            <div className="text-xs uppercase font-semibold text-[#94A3B8] tracking-wider">
              ANALYZED GEOGRAPHIC TARGET
            </div>
            <div className="text-base font-semibold text-[#F8FAFC]">{regionLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[#CBD5E1]">
            <Calendar className="w-3.5 h-3.5 text-[#F97316]" />
            <span>
              Period: {analysis_window.start_year}–{analysis_window.end_year} ({analysis_window.total_years} years)
            </span>
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Events */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0F172A] border border-[#334155] relative overflow-hidden group shadow-sm">
          <div className="flex items-center justify-between text-[#CBD5E1] mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Total Heatwaves
            </span>
            <Flame className="w-4 h-4 text-[#F97316] group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] font-mono">
            {totalEvents}
          </div>
          <div className="text-[13px] text-[#CBD5E1] mt-1">
            <span>{totalEvents === 0 ? "No qualifying events" : "Qualifying heatwave events"}</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-[#F97316]/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Total Heatwave Days & Average Duration */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0F172A] border border-[#334155] relative overflow-hidden group shadow-sm">
          <div className="flex items-center justify-between text-[#CBD5E1] mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Extreme Heat Days
            </span>
            <Clock className="w-4 h-4 text-[#FB923C] group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] font-mono">
            {totalHeatwaveDays}
            <span className="text-sm font-normal text-[#94A3B8] ml-1">days</span>
          </div>
          <div className="text-[13px] text-[#CBD5E1] mt-1">
            <span>
              Avg duration:{" "}
              <strong className="text-[#F8FAFC] font-mono">
                {avgEventDuration !== null ? `${formatNumber(avgEventDuration, 1)} d/event` : "N/A"}
              </strong>
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-[#FB923C]/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Heatwave Trend & Units */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0F172A] border border-[#334155] relative overflow-hidden group shadow-sm">
          <div className="flex items-center justify-between text-[#CBD5E1] mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Frequency Trend
            </span>
            <TrendingUp className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] font-mono flex items-baseline gap-1">
            {freqTrend?.slope_per_decade !== null && freqTrend?.slope_per_decade !== undefined ? (
              <>
                <span>{formatSlope(freqTrend.slope_per_decade, 2)}</span>
                <span className="text-xs font-sans font-medium text-[#CBD5E1]">
                  {freqTrend.unit || "events/dec"}
                </span>
              </>
            ) : (
              <span className="text-sm text-[#94A3B8]">N/A (Insufficient Data)</span>
            )}
          </div>
          <div className="text-xs mt-1">
            {freqBadge ? (
              <span
                className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${freqBadge.className}`}
              >
                {freqBadge.label}
              </span>
            ) : (
              <span className="text-[#94A3B8] text-[11px]">OLS Regression</span>
            )}
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Peak Temperature Exceedance */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0F172A] border border-[#334155] relative overflow-hidden group shadow-sm">
          <div className="flex items-center justify-between text-[#CBD5E1] mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Peak Exceedance
            </span>
            <Thermometer className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] font-mono">
            {peakExceedance !== null ? `+${formatNumber(peakExceedance, 1)}°C` : "N/A"}
          </div>
          <div className="text-[13px] text-[#CBD5E1] mt-1 flex items-center justify-between gap-1">
            <span className="text-xs text-[#94A3B8]">Above threshold</span>
            <div className="flex items-center gap-1 font-mono text-xs text-[#10B981]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{formatPercent(data_quality.completeness_percentage)}</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
