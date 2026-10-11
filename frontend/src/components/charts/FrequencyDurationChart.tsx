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
} from "recharts";
import { AnnualHeatwaveMetricDTO, TrendStatisticsDTO, QualityStatus } from "@/types/api";
import { formatNumber, getQualityStatusBadge } from "@/lib/utils";
import { Flame, Clock, BarChart2 } from "lucide-react";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      year: number;
      eventCount: number;
      totalDays: number;
      meanDuration: number | null;
      qualityStatus: QualityStatus;
      completeness: number;
      isProvisional: boolean;
    };
  }>;
  label?: string | number;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const badge = getQualityStatusBadge(item.qualityStatus);

  return (
    <div className="bg-zinc-900 border border-zinc-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-2 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-1.5">
        <span className="font-bold text-zinc-100 font-mono text-sm">{label}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Heatwave Events:
          </span>
          <span className="font-semibold text-zinc-100 font-mono">{item.eventCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Total Days:
          </span>
          <span className="font-semibold text-zinc-100 font-mono">{item.totalDays} days</span>
        </div>
        {item.meanDuration !== null && item.meanDuration !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400">Avg Duration:</span>
            <span className="font-semibold text-zinc-300 font-mono">
              {formatNumber(item.meanDuration, 1)} days
            </span>
          </div>
        )}
        <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800">
          Observation Completeness: {formatNumber(item.completeness, 1)}%
        </div>
      </div>
    </div>
  );
};

interface FrequencyDurationChartProps {
  metrics: AnnualHeatwaveMetricDTO[];
  frequencyTrend?: TrendStatisticsDTO;
  daysTrend?: TrendStatisticsDTO;
}

export const FrequencyDurationChart: React.FC<FrequencyDurationChartProps> = ({
  metrics,
  frequencyTrend,
  daysTrend,
}) => {
  const [viewMode, setViewMode] = useState<"both" | "events" | "days">("both");

  // Prepare chart data
  const chartData = metrics.map((m) => ({
    year: m.year,
    eventCount: m.event_count,
    totalDays: m.total_heatwave_days,
    meanDuration: m.mean_duration_days,
    qualityStatus: m.quality_status,
    completeness: m.completeness_percentage,
    isProvisional: m.quality_status === "provisional",
  }));

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-orange-400" />
            Annual Heatwave Frequency &amp; Duration
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Annual event occurrences (bars) vs. cumulative extreme heat days (line)
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-0.5 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
          <button
            onClick={() => setViewMode("both")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "both" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Combined
          </button>
          <button
            onClick={() => setViewMode("events")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "events" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Events Only
          </button>
          <button
            onClick={() => setViewMode("days")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "days" ? "bg-zinc-800 text-zinc-100 font-medium" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Days Only
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="year"
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
            />
            {(viewMode === "both" || viewMode === "events") && (
              <YAxis
                yAxisId="left"
                stroke="#f97316"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                allowDecimals={false}
                label={{
                  value: "Events / Year",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#f97316",
                  fontSize: 10,
                  offset: 15,
                }}
              />
            )}
            {(viewMode === "both" || viewMode === "days") && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#fbbf24"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                allowDecimals={false}
                label={{
                  value: "Extreme Days / Year",
                  angle: 90,
                  position: "insideRight",
                  fill: "#fbbf24",
                  fontSize: 10,
                  offset: 15,
                }}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
              formatter={(value) => <span className="text-zinc-300">{value}</span>}
            />

            {(viewMode === "both" || viewMode === "events") && (
              <Bar
                yAxisId="left"
                dataKey="eventCount"
                name="Annual Heatwave Events"
                fill="#f97316"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            )}

            {(viewMode === "both" || viewMode === "days") && (
              <Line
                yAxisId={viewMode === "both" ? "right" : "left"}
                type="monotone"
                dataKey="totalDays"
                name="Heatwave Days"
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: "#fbbf24" }}
                activeDot={{ r: 5, fill: "#f59e0b" }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Decadal Trend Annotation Footer */}
      {(frequencyTrend || daysTrend) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800 text-xs">
          {frequencyTrend && frequencyTrend.slope_per_decade !== null && (
            <div className="text-zinc-400">
              Frequency Trend:{" "}
              <strong className="text-zinc-200 font-mono">
                {frequencyTrend.slope_per_decade > 0 ? "+" : ""}
                {formatNumber(frequencyTrend.slope_per_decade, 2)} events/decade
              </strong>{" "}
              {frequencyTrend.is_significant ? (
                <span className="text-rose-400 font-medium">(p &lt; 0.05 significant)</span>
              ) : (
                <span className="text-zinc-500">(non-significant)</span>
              )}
            </div>
          )}
          {daysTrend && daysTrend.slope_per_decade !== null && (
            <div className="text-zinc-400">
              Duration Trend:{" "}
              <strong className="text-zinc-200 font-mono">
                {daysTrend.slope_per_decade > 0 ? "+" : ""}
                {formatNumber(daysTrend.slope_per_decade, 1)} days/decade
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
