import React from "react";
import { ShieldAlert, ShieldCheck, Info, Clock } from "lucide-react";
import { DataQualityDTO, AnnualHeatwaveMetricDTO } from "@/types/api";
import { formatPercent } from "@/lib/utils";

interface DataQualityBannerProps {
  dataQuality: DataQualityDTO;
  annualMetrics: AnnualHeatwaveMetricDTO[];
}

export const DataQualityBanner: React.FC<DataQualityBannerProps> = ({
  dataQuality,
  annualMetrics,
}) => {
  const currentYear = new Date().getFullYear();
  const provisionalYear = annualMetrics.find(
    (m) => m.year === currentYear || m.quality_status === "provisional"
  );
  const incompleteYears = annualMetrics.filter(
    (m) => m.quality_status === "incomplete" || m.quality_status === "insufficient_data"
  );

  return (
    <div className="space-y-2.5">
      <div
        className={`p-3.5 rounded-xl border transition-all ${
          dataQuality.has_critical_gaps
            ? "bg-rose-950/20 border-rose-500/40 text-rose-200"
            : "bg-[#0F172A] border-[#334155] text-[#94A3B8]"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            {dataQuality.has_critical_gaps ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-[#F8FAFC]">
                  {dataQuality.has_critical_gaps
                    ? "Critical Data Gaps Detected"
                    : "Observation Data Quality: High Completeness"}
                </h4>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-[#1E293B] text-[#10B981] border border-[#334155]">
                  {formatPercent(dataQuality.completeness_percentage)} Complete
                </span>
              </div>
              <p className="text-[13px] text-[#CBD5E1] mt-0.5 leading-relaxed">
                {dataQuality.has_critical_gaps
                  ? "Long missing observation streaks (>15 days) or low completeness (<90%) may affect statistical trend estimates."
                  : `${dataQuality.observed_days.toLocaleString()} observed daily records analyzed out of ${dataQuality.total_expected_days.toLocaleString()} expected days.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
            <div className="bg-[#090D16] px-3 py-1.5 rounded border border-[#1E293B]">
              <span className="text-[#94A3B8] block text-[11px] font-semibold uppercase">Missing Days</span>
              <span
                className={`text-sm font-semibold ${
                  dataQuality.missing_days > 0 ? "text-amber-400" : "text-[#10B981]"
                }`}
              >
                {dataQuality.missing_days.toLocaleString()}d
              </span>
            </div>

            <div className="bg-[#090D16] px-3 py-1.5 rounded border border-[#1E293B]">
              <span className="text-[#94A3B8] block text-[11px] font-semibold uppercase">Max Gap</span>
              <span
                className={`text-sm font-semibold ${
                  dataQuality.longest_missing_streak_days > 5
                    ? "text-rose-400"
                    : "text-[#10B981]"
                }`}
              >
                {dataQuality.longest_missing_streak_days}d
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Provisional Current Year Notice */}
      {provisionalYear && (
        <div className="p-3 rounded-lg bg-[#0F172A] border border-[#334155] text-[13px] text-[#CBD5E1] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-[#F8FAFC]">Year {provisionalYear.year} is provisional</strong> (in-progress calendar year:{" "}
              {provisionalYear.usable_days}/{provisionalYear.expected_days} days ingested). Automatically excluded from long-term OLS slope regressions.
            </span>
          </div>
        </div>
      )}

      {/* Excluded Incomplete Years Notice */}
      {incompleteYears.length > 0 && (
        <div className="p-3 rounded-lg bg-[#0F172A] border border-[#334155] text-[13px] text-[#CBD5E1] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#FB923C] shrink-0" />
            <span>
              <strong className="text-[#F8FAFC]">{incompleteYears.length} year(s)</strong> with &gt;10% missing records (
              {incompleteYears.map((y) => y.year).join(", ")}) excluded from trend regression to prevent bias.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
