"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import { AnnualHeatwaveMetricDTO, TrendStatisticsDTO, QualityStatus } from "@/types/api";
import { formatNumber, formatSlope, getQualityStatusBadge } from "@/lib/utils";
import { Flame, Thermometer, Info, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface CustomThermalTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      year: number;
      peakExceedance: number | null;
      meanPeakTemp: number | null;
      cumulativeDegreeDays: number | null;
      eventCount: number;
      qualityStatus: QualityStatus;
      isProvisional: boolean;
      isExcludedFromTrend: boolean;
    };
  }>;
  label?: string | number;
}

const CustomThermalTooltip: React.FC<CustomThermalTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const badge = getQualityStatusBadge(item.qualityStatus);

  return (
    <div className="bg-zinc-900 border border-zinc-700/80 p-3.5 rounded-xl shadow-2xl text-xs space-y-2.5 backdrop-blur-md max-w-xs">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-1.5">
        <span className="font-bold text-zinc-100 font-mono text-sm">Year {label}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {item.eventCount > 0 ? (
        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400 font-sans flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              Peak Daily Excess Temp:
            </span>
            <span className="font-bold text-rose-300">
              {item.peakExceedance !== null ? `+${formatNumber(item.peakExceedance, 1)}°C` : "N/A"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400 font-sans">Mean Peak Event Temp:</span>
            <span className="font-semibold text-zinc-200">
              {item.meanPeakTemp !== null ? `${formatNumber(item.meanPeakTemp, 1)}°C` : "N/A"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400 font-sans flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Cumulative Heat Burden:
            </span>
            <span className="font-semibold text-orange-300">
              {item.cumulativeDegreeDays !== null
                ? `${formatNumber(item.cumulativeDegreeDays, 1)} °C-days`
                : "N/A"}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-zinc-500 italic text-[11px]">
          No qualifying heatwave events occurred in this year. Thermal exceedance is not applicable.
        </p>
      )}

      {/* Scientific Regression Status Notice */}
      <div
        className={`p-1.5 rounded text-[10px] flex items-center gap-1.5 border ${
          item.isExcludedFromTrend
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
        }`}
      >
        {item.isProvisional ? (
          <>
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Excluded from trend regression (ongoing year)</span>
          </>
        ) : item.isExcludedFromTrend ? (
          <>
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Excluded from trend regression (insufficient observations)</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Included in OLS decadal trend regression</span>
          </>
        )}
      </div>
    </div>
  );
};

interface HeatwaveIntensityChartProps {
  metrics: AnnualHeatwaveMetricDTO[];
  intensityTrend?: TrendStatisticsDTO;
}

export const HeatwaveIntensityChart: React.FC<HeatwaveIntensityChartProps> = ({
  metrics,
  intensityTrend,
}) => {
  type ViewMode = "temperature" | "degree_days" | "both";
  const [viewMode, setViewMode] = useState<ViewMode>("both");

  if (!metrics || metrics.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-center text-xs text-zinc-400">
        No heatwave intensity data available.
      </div>
    );
  }

  // Preserve nulls for years without events - do not convert to 0°C
  const chartData = metrics.map((m) => ({
    year: m.year,
    peakExceedance: m.peak_intensity_celsius, // Excess temperature above threshold (°C)
    meanPeakTemp: m.mean_peak_temperature_celsius, // Absolute peak temperature (°C)
    cumulativeDegreeDays: m.cumulative_intensity_degree_days, // Thermal heat burden (°C-days)
    eventCount: m.event_count,
    qualityStatus: m.quality_status,
    isProvisional: m.quality_status === "provisional",
    isExcludedFromTrend: m.quality_status !== "reliable",
  }));

  const hasTrend = intensityTrend && intensityTrend.slope_per_decade !== null;
  const startYear = metrics[0]?.year;
  const endYear = metrics[metrics.length - 1]?.year;

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md space-y-4">
      {/* Screen Reader Summary */}
      <div className="sr-only" aria-live="polite">
        Annual heatwave intensity chart for years {startYear} through {endYear}.
        Presents daily excess temperatures above threshold in degrees Celsius and annual cumulative degree-days.
        {hasTrend
          ? `Cumulative heat burden trend slope is ${formatSlope(intensityTrend!.slope_per_decade, 1)} ${intensityTrend!.unit}.`
          : "Insufficient reliable data to evaluate cumulative intensity trend."}
      </div>

      {/* Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-rose-400" />
            Heatwave Intensity &amp; Thermal Exceedance
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Daily excess-temperature above threshold (°C) and cumulative degree-days (°C-days)
          </p>
        </div>

        {/* View mode toggle to prevent unit mixing */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("both")}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              viewMode === "both"
                ? "bg-zinc-800 text-zinc-100 font-semibold shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Split View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("temperature")}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              viewMode === "temperature"
                ? "bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Excess Temp (°C)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("degree_days")}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              viewMode === "degree_days"
                ? "bg-orange-500/20 text-orange-300 font-semibold border border-orange-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Heat Burden (°C-days)
          </button>
        </div>
      </div>

      {/* Temperature Charts Container */}
      <div className="space-y-6">
        {/* Chart 1: Daily Excess Temperature & Absolute Peak in Celsius (°C) */}
        {(viewMode === "temperature" || viewMode === "both") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5" />
                Thermal Metrics (Celsius, °C)
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                Years with 0 events show gaps (intensity is undefined, not 0°C)
              </span>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="year"
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#3f3f46" }}
                  />
                  <YAxis
                    stroke="#f43f5e"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#3f3f46" }}
                    domain={["auto", "auto"]}
                    label={{
                      value: "Temperature (°C)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#f43f5e",
                      fontSize: 10,
                      offset: 15,
                    }}
                  />
                  <Tooltip content={<CustomThermalTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "5px" }}
                    formatter={(value) => <span className="text-zinc-300">{value}</span>}
                  />

                  {/* Daily Peak Exceedance Above Threshold (°C) */}
                  <Line
                    type="monotone"
                    dataKey="peakExceedance"
                    name="Peak Daily Excess Temp Above Threshold (°C)"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#f43f5e" }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />

                  {/* Mean Peak Heatwave Temperature (°C) */}
                  <Line
                    type="monotone"
                    dataKey="meanPeakTemp"
                    name="Mean Peak Event Temp (°C)"
                    stroke="#fb7185"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={{ r: 2, fill: "#fb7185" }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart 2: Cumulative Degree-Days (°C-days) */}
        {(viewMode === "degree_days" || viewMode === "both") && (
          <div className="space-y-2 pt-2 border-t border-zinc-800/60">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="font-semibold text-orange-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                Cumulative Thermal Burden (Degree-Days, °C-days)
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                Integrated annual sum of exceedance degrees across all heatwave days
              </span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <defs>
                    <pattern
                      id="provisionalIntensityStripes"
                      width="6"
                      height="6"
                      patternTransform="rotate(45 0 0)"
                      patternUnits="userSpaceOnUse"
                    >
                      <line x1="0" y1="0" x2="0" y2="6" stroke="#f97316" strokeWidth="3" />
                      <line x1="0" y1="0" x2="6" y2="0" stroke="#78350f" strokeWidth="1" />
                    </pattern>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="year"
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#3f3f46" }}
                  />
                  <YAxis
                    stroke="#f97316"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "#3f3f46" }}
                    label={{
                      value: "Cumulative (°C-days)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#f97316",
                      fontSize: 10,
                      offset: 15,
                    }}
                  />
                  <Tooltip content={<CustomThermalTooltip />} />
                  <Bar
                    dataKey="cumulativeDegreeDays"
                    name="Cumulative Heat Burden (°C-days)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  >
                    {chartData.map((entry, index) => {
                      if (entry.isProvisional) {
                        return (
                          <Cell
                            key={`cell-int-${index}`}
                            fill="url(#provisionalIntensityStripes)"
                            stroke="#f97316"
                            strokeWidth={1}
                          />
                        );
                      }
                      return <Cell key={`cell-int-${index}`} fill="#f97316" />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Cumulative Heat Burden Decadal Trend */}
      <div className="pt-3 border-t border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-2">
        {hasTrend ? (
          <div className="text-zinc-300">
            Cumulative Heat Burden Trend:{" "}
            <strong className="text-zinc-100 font-mono">
              {formatSlope(intensityTrend!.slope_per_decade, 1)} {intensityTrend!.unit}
            </strong>{" "}
            {intensityTrend!.is_significant ? (
              <span className="text-rose-400 font-semibold">(p &lt; 0.05 statistically significant)</span>
            ) : (
              <span className="text-zinc-400">
                (statistically non-significant, p = {formatNumber(intensityTrend!.p_value, 3)})
              </span>
            )}
          </div>
        ) : (
          <div className="text-zinc-400 italic flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-500" />
            <span>Insufficient data to compute cumulative intensity trend.</span>
          </div>
        )}

        <div className="text-[11px] text-zinc-500 font-mono">
          Regression Sample: {intensityTrend?.sample_size_years ?? metrics.length} reliable years
        </div>
      </div>
    </div>
  );
};
