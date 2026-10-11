"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { AnnualHeatwaveMetricDTO, TrendStatisticsDTO } from "@/types/api";
import { formatNumber } from "@/lib/utils";
import { Flame, Thermometer } from "lucide-react";

interface CustomIntensityTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      year: number;
      peakTemp: number | null;
      cumulativeDegreeDays: number;
      peakExceedance: number | null;
      hasEvent: boolean;
    };
  }>;
  label?: string | number;
}

const CustomIntensityTooltip: React.FC<CustomIntensityTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;

  return (
    <div className="bg-zinc-900 border border-zinc-700/80 p-3 rounded-xl shadow-2xl text-xs space-y-2 backdrop-blur-md">
      <div className="font-bold text-zinc-100 font-mono text-sm border-b border-zinc-800 pb-1.5">
        {label} Climatological Intensity
      </div>
      {item.hasEvent ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              Peak Temperature:
            </span>
            <span className="font-semibold text-rose-300 font-mono">
              {formatNumber(item.peakTemp, 1)}°C
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Cumulative Degree-Days:
            </span>
            <span className="font-semibold text-orange-300 font-mono">
              {formatNumber(item.cumulativeDegreeDays, 1)} °C-days
            </span>
          </div>
        </div>
      ) : (
        <p className="text-zinc-500 italic">No heatwave events recorded in this year</p>
      )}
    </div>
  );
};

interface IntensityTrendsChartProps {
  metrics: AnnualHeatwaveMetricDTO[];
  intensityTrend?: TrendStatisticsDTO;
}

export const IntensityTrendsChart: React.FC<IntensityTrendsChartProps> = ({
  metrics,
  intensityTrend,
}) => {
  // Format data for Recharts, keeping nulls safe
  const chartData = metrics.map((m) => ({
    year: m.year,
    peakTemp: m.peak_intensity_celsius,
    cumulativeDegreeDays: m.cumulative_intensity_degree_days ?? 0,
    peakExceedance: m.peak_intensity_celsius !== null ? m.peak_intensity_celsius : null,
    hasEvent: m.event_count > 0,
  }));

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-rose-400" />
          Heatwave Intensity &amp; Cumulative Heat Burden
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Annual maximum recorded heatwave temperature (°C) and cumulative exceedance degree-days
        </p>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="degreeDaysGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
              </linearGradient>
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
              yAxisId="left"
              stroke="#f43f5e"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              domain={["dataMin - 2", "dataMax + 2"]}
              label={{
                value: "Peak Temp (°C)",
                angle: -90,
                position: "insideLeft",
                fill: "#f43f5e",
                fontSize: 10,
                offset: 15,
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#f97316"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              label={{
                value: "Cumulative °C-days",
                angle: 90,
                position: "insideRight",
                fill: "#f97316",
                fontSize: 10,
                offset: 15,
              }}
            />
            <Tooltip content={<CustomIntensityTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
              formatter={(value) => <span className="text-zinc-300">{value}</span>}
            />

            <Area
              yAxisId="right"
              type="monotone"
              dataKey="cumulativeDegreeDays"
              name="Cumulative Degree-Days (°C-days)"
              fill="url(#degreeDaysGrad)"
              stroke="#f97316"
              strokeWidth={1.5}
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="peakTemp"
              name="Peak Heatwave Temp (°C)"
              stroke="#f43f5e"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#f43f5e" }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {intensityTrend && intensityTrend.slope_per_decade !== null && (
        <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-400">
          Cumulative Heat Burden Trend:{" "}
          <strong className="text-zinc-200 font-mono">
            {intensityTrend.slope_per_decade > 0 ? "+" : ""}
            {formatNumber(intensityTrend.slope_per_decade, 1)} °C-days/decade
          </strong>
        </div>
      )}
    </div>
  );
};
