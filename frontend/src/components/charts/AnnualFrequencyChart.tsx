"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { AnnualHeatwaveMetricDTO, TrendStatisticsDTO, QualityStatus } from "@/types/api";
import { formatNumber, formatSlope, getQualityStatusBadge } from "@/lib/utils";
import { Flame, Info } from "lucide-react";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      year: number;
      eventCount: number;
      qualityStatus: QualityStatus;
      completeness: number;
      usableDays: number;
      expectedDays: number;
      isProvisional: boolean;
      isZeroEvent: boolean;
    };
  }>;
  label?: string | number;
}

const CustomFrequencyTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  const badge = getQualityStatusBadge(item.qualityStatus);

  return (
    <div className="bg-zinc-900 border border-zinc-700/80 p-3.5 rounded-xl shadow-2xl text-xs space-y-2 backdrop-blur-md max-w-xs">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-1.5">
        <span className="font-bold text-zinc-100 font-mono text-sm">Year {label}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Heatwave Events:
          </span>
          <span className="font-bold text-zinc-100 font-mono text-sm">
            {item.eventCount}
          </span>
        </div>

        {item.isZeroEvent && (
          <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 italic">
            Zero qualifying events detected during valid meteorological observations.
          </div>
        )}

        {item.isProvisional && (
          <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
            Provisional ongoing year ({item.usableDays}/{item.expectedDays} days recorded).
          </div>
        )}

        <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/80 flex justify-between">
          <span>Observation Integrity:</span>
          <span className="font-mono text-zinc-300">{formatNumber(item.completeness, 1)}%</span>
        </div>
      </div>
    </div>
  );
};

interface AnnualFrequencyChartProps {
  metrics: AnnualHeatwaveMetricDTO[];
  frequencyTrend?: TrendStatisticsDTO;
}

export const AnnualFrequencyChart: React.FC<AnnualFrequencyChartProps> = ({
  metrics,
  frequencyTrend,
}) => {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-center text-xs text-zinc-400">
        No annual frequency data available for the selected parameters.
      </div>
    );
  }

  const chartData = metrics.map((m) => ({
    year: m.year,
    eventCount: m.event_count,
    qualityStatus: m.quality_status,
    completeness: m.completeness_percentage,
    usableDays: m.usable_days,
    expectedDays: m.expected_days,
    isProvisional: m.quality_status === "provisional",
    isZeroEvent: m.event_count === 0,
  }));

  // Bar color based on data quality status
  const getBarColor = (status: QualityStatus) => {
    switch (status) {
      case "provisional":
        return "#f59e0b"; // Amber for ongoing calendar year
      case "incomplete":
        return "#ea580c"; // Dark orange for degraded
      case "insufficient_data":
        return "#71717a"; // Muted zinc for insufficient data
      case "reliable":
      default:
        return "#f97316"; // Standard vibrant heat orange
    }
  };

  const hasTrend = frequencyTrend && frequencyTrend.slope_per_decade !== null;

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            Annual Heatwave Event Frequency
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Discrete qualifying heatwave event occurrences per calendar year
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> Reliable Year
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Provisional Year
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
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
            <Tooltip content={<CustomFrequencyTooltip />} />
            <Bar dataKey="eventCount" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.qualityStatus)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Decadal Frequency Trend Footer */}
      <div className="pt-3 border-t border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-2">
        {hasTrend ? (
          <div className="text-zinc-300">
            OLS Linear Trend:{" "}
            <strong className="text-zinc-100 font-mono">
              {formatSlope(frequencyTrend!.slope_per_decade, 2)} {frequencyTrend!.unit}
            </strong>{" "}
            {frequencyTrend!.is_significant ? (
              <span className="text-rose-400 font-semibold">(p &lt; 0.05 statistically significant)</span>
            ) : (
              <span className="text-zinc-400">(statistically non-significant, p = {formatNumber(frequencyTrend!.p_value, 3)})</span>
            )}
          </div>
        ) : (
          <div className="text-zinc-400 italic flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-500" />
            <span>Insufficient reliable observation years (&lt;10y) to derive a statistically sound trend.</span>
          </div>
        )}

        <div className="text-[11px] text-zinc-500 font-mono">
          Sample: {frequencyTrend?.sample_size_years ?? metrics.length} reliable years
        </div>
      </div>
    </div>
  );
};
