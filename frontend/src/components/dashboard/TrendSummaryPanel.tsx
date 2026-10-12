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
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F8FAFC] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#F97316]" />
            Statistical Trend Analysis (OLS Linear Regression)
          </h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Decadal change across reliable historical observations (p &lt; 0.05 indicates significance)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {trendItems.map(({ key, title, subtitle, data }) => {
          if (!data) return null;

          const badge = getTrendDirectionBadge(data.direction, data.is_significant);
          const hasSufficientData = data.slope_per_decade !== null;

          return (
            <div
              key={key}
              className="p-4 sm:p-5 rounded-xl bg-[#0F172A] border border-[#334155] flex flex-col justify-between space-y-3.5 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-[#F8FAFC]">{title}</h4>
                    <p className="text-[11px] text-[#64748B]">{subtitle}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${badge.className}`}
                  >
                    {data.direction === "increasing" && <TrendingUp className="w-3 h-3" />}
                    {data.direction === "decreasing" && <TrendingDown className="w-3 h-3" />}
                    {data.direction === "stable" && <Minus className="w-3 h-3" />}
                    {data.direction === "indeterminate" && <HelpCircle className="w-3 h-3" />}
                    {badge.label}
                  </span>
                </div>

                {hasSufficientData ? (
                  <div className="space-y-2 mt-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-[#F8FAFC]">
                        {formatSlope(data.slope_per_decade, 2)}
                      </span>
                      <span className="text-xs font-mono text-[#94A3B8]">{data.unit}</span>
                    </div>

                    <div className="space-y-1 text-xs text-[#94A3B8] font-mono bg-[#090D16] p-2.5 rounded border border-[#1E293B]">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">p-value:</span>
                        <span
                          className={data.is_significant ? "text-[#10B981] font-semibold" : "text-[#94A3B8]"}
                        >
                          {formatPValue(data.p_value)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Annual rate:</span>
                        <span className="text-[#F8FAFC]">
                          {data.slope_per_year !== null
                            ? `${formatSlope(data.slope_per_year, 3)}/yr`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Sample:</span>
                        <span className="text-[#F8FAFC]">{data.sample_size_years} years</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-[#090D16] rounded border border-[#1E293B] text-xs text-[#94A3B8] flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-[#64748B] shrink-0 mt-0.5" />
                    <span>
                      Insufficient reliable data ({data.sample_size_years} &lt; 10 quality years) to estimate trend.
                    </span>
                  </div>
                )}
              </div>

              {data.description && (
                <p className="text-xs text-[#64748B] pt-2 border-t border-[#1E293B] leading-relaxed">
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
