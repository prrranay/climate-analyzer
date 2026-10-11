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
    <div className="space-y-3">
      <div
        className={`p-4 rounded-xl border backdrop-blur-md transition-all ${
          dataQuality.has_critical_gaps
            ? "bg-rose-950/20 border-rose-500/40 text-rose-200"
            : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {dataQuality.has_critical_gaps ? (
              <ShieldAlert className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-zinc-100">
                  {dataQuality.has_critical_gaps
                    ? "Critical Data Gaps Detected"
                    : "Observation Data Quality: High Completeness"}
                </h4>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {formatPercent(dataQuality.completeness_percentage)} Complete
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {dataQuality.has_critical_gaps
                  ? "Long missing observation streaks (>15 days) or low completeness (<90%) may affect statistical trend estimates."
                  : `${dataQuality.observed_days.toLocaleString()} observed daily records analyzed out of ${dataQuality.total_expected_days.toLocaleString()} expected days.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono shrink-0">
            <div className="bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block text-[10px] uppercase">Missing Days</span>
              <span className="font-semibold text-zinc-200">{dataQuality.missing_days}</span>
            </div>
            <div className="bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block text-[10px] uppercase">Max Gap Streak</span>
              <span className="font-semibold text-zinc-200">
                {dataQuality.longest_missing_streak_days} days
              </span>
            </div>
          </div>
        </div>

        {/* Completeness progress bar */}
        <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              dataQuality.completeness_percentage >= 95
                ? "bg-emerald-500"
                : dataQuality.completeness_percentage >= 90
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
            style={{ width: `${Math.min(100, dataQuality.completeness_percentage)}%` }}
          />
        </div>
      </div>

      {/* Provisional or Incomplete year notices */}
      {(provisionalYear || incompleteYears.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {provisionalYear && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Provisional Year ({provisionalYear.year}): </strong>
                <span>
                  The current year is ongoing ({provisionalYear.usable_days}/{provisionalYear.expected_days} days recorded).
                  Metrics are provisional and excluded from statistical trend regression.
                </span>
              </div>
            </div>
          )}

          {incompleteYears.length > 0 && (
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-zinc-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold text-zinc-200">Degraded Years: </strong>
                <span>
                  {incompleteYears.length} year(s) flagged with missing observations (
                  {incompleteYears.map((y) => y.year).slice(0, 4).join(", ")}
                  {incompleteYears.length > 4 ? "..." : ""}).
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
