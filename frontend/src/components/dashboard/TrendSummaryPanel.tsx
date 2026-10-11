"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus, HelpCircle, Info } from "lucide-react";
import { TrendStatisticsDTO } from "@/types/api";
import { formatSlope, formatPValue, getTrendDirectionBadge } from "@/lib/utils";

interface TrendSummaryPanelProps {
  trends: Record<string, TrendStatisticsDTO>;
}

export const TrendSummaryPanel: React.FC<TrendSummaryPanelProps> = ({ trends }) => {
  const trendItems = [
    {
      key: "annual_frequency",
      title: "Annual Frequency",
      subtitle: "Frequency of heatwave events",
      data: trends["annual_frequency"],
    },
    {
      key: "heatwave_days",
      title: "Total Heatwave Days",
      subtitle: "Cumulative days in heatwave status",
      data: trends["heatwave_days"],
    },
    {
      key: "cumulative_intensity",
      title: "Cumulative Heat Burden",
      subtitle: "Total exceedance degree-days",
      data: trends["cumulative_intensity"],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            Statistical Trend Analysis (OLS Linear Regression)
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Backend-evaluated decadal change across reliable historical years (p &lt; 0.05 indicates statistical significance)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {trendItems.map(({ key, title, subtitle, data }) => {
          if (!data) return null;

          const badge = getTrendDirectionBadge(data.direction, data.is_significant);
          const hasSufficientData = data.slope_per_decade !== null;

          return (
            <div
              key={key}
              className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
                    <p className="text-[11px] text-zinc-400">{subtitle}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${badge.className}`}
                  >
                    {data.direction === "increasing" && <TrendingUp className="w-3 h-3" />}
                    {data.direction === "decreasing" && <TrendingDown className="w-3 h-3" />}
                    {data.direction === "stable" && <Minus className="w-3 h-3" />}
                    {data.direction === "indeterminate" && <HelpCircle className="w-3 h-3" />}
                    {badge.label}
                  </span>
                </div>

                {hasSufficientData ? (
                  <div className="space-y-2 mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-zinc-100">
                        {/* Numeric zero slope is explicitly displayed as 0.00, not N/A */}
                        {formatSlope(data.slope_per_decade, 2)}
                      </span>
                      <span className="text-xs text-zinc-400">{data.unit}</span>
                    </div>

                    <div className="space-y-1 text-xs text-zinc-400 font-mono bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">p-value:</span>
                        <span
                          className={data.is_significant ? "text-emerald-400 font-semibold" : "text-zinc-400"}
                        >
                          {formatPValue(data.p_value)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Annual rate:</span>
                        <span className="text-zinc-300">
                          {data.slope_per_year !== null
                            ? `${formatSlope(data.slope_per_year, 3)}/yr`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Sample size:</span>
                        <span className="text-zinc-300">{data.sample_size_years} reliable years</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800 text-xs text-zinc-400 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                    <span>
                      Insufficient reliable historical data ({data.sample_size_years} &lt; 10 quality years) to estimate a robust climate trend.
                    </span>
                  </div>
                )}
              </div>

              {data.description && (
                <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-800/80 leading-relaxed">
                  {data.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
