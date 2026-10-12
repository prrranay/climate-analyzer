"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import { AnnualHeatwaveMetricDTO, TrendStatisticsDTO, QualityStatus } from "@/types/api";
import { formatNumber, formatSlope, getQualityStatusBadge } from "@/lib/utils";
import { Clock, Info, CheckCircle2, AlertTriangle } from "lucide-react";

interface CustomDurationTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      year: number;
      totalDays: number;
      meanDuration: number | null;
      maxDuration: number | null;
      eventCount: number;
      qualityStatus: QualityStatus;
      isProvisional: boolean;
      isExcludedFromTrend: boolean;
    };
  }>;
  label?: string | number;
}

const CustomDurationTooltip: React.FC<CustomDurationTooltipProps> = ({ active, payload, label }) => {
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Total Heatwave Days:
          </span>
          <span className="font-bold text-zinc-100 font-mono">
            {item.totalDays} days
          </span>
        </div>

        {item.eventCount > 0 ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-400">Mean Event Duration:</span>
              <span className="font-mono text-amber-300">
                {item.meanDuration !== null ? `${formatNumber(item.meanDuration, 1)} days` : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-400">Max Event Duration:</span>
              <span className="font-mono text-amber-300">
                {item.maxDuration !== null ? `${item.maxDuration} days` : "N/A"}
              </span>
            </div>
          </>
        ) : item.totalDays > 0 ? (
          <div className="p-1.5 rounded bg-zinc-950 text-[11px] text-amber-300/90 border border-amber-500/20">
            No events started this year ({item.totalDays} {item.totalDays === 1 ? "day" : "days"} attributed from prior-year event).
          </div>
        ) : (
          <div className="p-1 rounded bg-zinc-950 text-[11px] text-zinc-400 italic">
            Zero heatwave days recorded in this year.
          </div>
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
              <span>Excluded from trend regression (insufficient data)</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Included in OLS decadal trend regression</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface HeatwaveDurationChartProps {
  metrics: AnnualHeatwaveMetricDTO[];
  durationTrend?: TrendStatisticsDTO;
}

export const HeatwaveDurationChart: React.FC<HeatwaveDurationChartProps> = ({
  metrics,
  durationTrend,
}) => {
  const [showMeanDuration, setShowMeanDuration] = useState(true);

  if (!metrics || metrics.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-center text-xs text-zinc-400">
        No duration data available.
      </div>
    );
  }

  const chartData = metrics.map((m) => ({
    year: m.year,
    totalDays: m.total_heatwave_days,
    meanDuration: m.mean_duration_days,
    maxDuration: m.max_duration_days,
    eventCount: m.event_count,
    qualityStatus: m.quality_status,
    isProvisional: m.quality_status === "provisional",
    isExcludedFromTrend: m.quality_status !== "reliable",
  }));

  const hasTrend = durationTrend && durationTrend.slope_per_decade !== null;
  const startYear = metrics[0]?.year;
  const endYear = metrics[metrics.length - 1]?.year;
  const totalDays = metrics.reduce((acc, m) => acc + m.total_heatwave_days, 0);

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md space-y-4">
      {/* Screen Reader Summary */}
      <div className="sr-only" aria-live="polite">
        Annual heatwave duration chart from year {startYear} to {endYear}.
        Total cumulative heatwave days across period: {totalDays} days.
        {hasTrend
          ? `Decadal duration trend slope is ${formatSlope(durationTrend!.slope_per_decade, 1)} ${durationTrend!.unit}.`
          : "Insufficient reliable data to evaluate duration trend."}
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Heatwave Duration (Days)
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cumulative annual heatwave days and mean duration per discrete event (in days)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowMeanDuration(!showMeanDuration)}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
            showMeanDuration
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
              : "bg-zinc-800 border-zinc-700 text-zinc-400"
          }`}
        >
          {showMeanDuration ? "Hide Mean Duration" : "Show Mean Duration"}
        </button>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <pattern
                id="provisionalDurationStripes"
                width="6"
                height="6"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="#fbbf24" strokeWidth="3" />
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
              stroke="#fbbf24"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              allowDecimals={false}
              label={{
                value: "Duration (Days / Year)",
                angle: -90,
                position: "insideLeft",
                fill: "#fbbf24",
                fontSize: 10,
                offset: 15,
              }}
            />
            <Tooltip content={<CustomDurationTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
              formatter={(value) => <span className="text-zinc-300">{value}</span>}
            />

            <Bar
              dataKey="totalDays"
              name="Total Heatwave Days"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            >
              {chartData.map((entry, index) => {
                if (entry.isProvisional) {
                  return (
                    <Cell
                      key={`cell-dur-${index}`}
                      fill="url(#provisionalDurationStripes)"
                      stroke="#fbbf24"
                      strokeWidth={1}
                    />
                  );
                }
                return <Cell key={`cell-dur-${index}`} fill="#fbbf24" />;
              })}
            </Bar>

            {showMeanDuration && (
              <Line
                type="monotone"
                dataKey="meanDuration"
                name="Mean Event Duration (Days)"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "#f97316" }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Decadal Duration Trend Footer */}
      <div className="pt-3 border-t border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-2">
        {hasTrend ? (
          <div className="text-zinc-300">
            Duration Trend:{" "}
            <strong className="text-zinc-100 font-mono">
              {formatSlope(durationTrend!.slope_per_decade, 1)} {durationTrend!.unit}
            </strong>{" "}
            {durationTrend!.is_significant ? (
              <span className="text-rose-400 font-semibold">(p &lt; 0.05 statistically significant)</span>
            ) : (
              <span className="text-zinc-400">
                (statistically non-significant, p = {formatNumber(durationTrend!.p_value, 3)})
              </span>
            )}
          </div>
        ) : (
          <div className="text-zinc-400 italic flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>Insufficient data to compute duration trend.</span>
          </div>
        )}

        <div className="text-[11px] text-zinc-500 font-mono">
          Regression Sample: {durationTrend?.sample_size_years ?? metrics.length} reliable years
        </div>
      </div>
    </div>
  );
};
