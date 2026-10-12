import React from "react";
import { Flame, Compass, TrendingUp, BarChart3, ShieldCheck, Info } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  onSelectPreset?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No Hazard Analysis Selected",
  description = "Search for any city worldwide, pick a preset region, or define a bounding box to analyze historical heatwave trends.",
  onSelectPreset,
}) => {
  return (
    <div className="w-full space-y-6">
      {/* Central Empty / Ready Stage Card */}
      <div className="w-full border border-dashed border-[#334155] rounded-xl bg-[#0F172A]/40 p-8 sm:p-12 flex flex-col items-center text-center relative overflow-hidden backdrop-blur-sm shadow-xl">
        {/* Radiating ambient halo */}
        <div className="absolute w-72 h-72 bg-[#F97316]/10 rounded-full blur-3xl pointer-events-none -top-10" />

        {/* Central Icon Badge with glowing aura */}
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#F97316]/15 border border-[#F97316]/40 flex items-center justify-center text-[#F97316] shadow-[0_0_24px_-4px_rgba(249,115,22,0.3)]">
            <Flame className="w-8 h-8 fill-[#F97316]" />
          </div>
        </div>

        {/* Headline & Context */}
        <h2 className="text-xl sm:text-2xl font-bold text-[#F8FAFC] tracking-tight mb-2">
          {title}
        </h2>
        <p className="text-sm text-[#94A3B8] max-w-lg mb-6 leading-relaxed">
          {description}
        </p>

        {/* Primary Fast-Start Action */}
        {onSelectPreset && (
          <button
            type="button"
            onClick={onSelectPreset}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-semibold text-sm shadow-[0_0_20px_-2px_rgba(249,115,22,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>Load Example (Phoenix, AZ)</span>
          </button>
        )}

        {/* Micro Helper Note */}
        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-mono text-[#64748B]">
          <Info className="w-3.5 h-3.5 text-[#F97316]" />
          <span>Demonstrates 1991–2020 ERA5 heat anomaly detection across 30 years</span>
        </div>
      </div>

      {/* Scientific Feature Teaser Bento Grid */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Feature 1: Trend slope detection */}
        <div className="p-4 rounded-lg bg-[#0F172A]/60 border border-[#1E293B] hover:border-[#334155] transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                METRIC ENGINE
              </span>
              <TrendingUp className="w-4 h-4 text-[#F97316]" />
            </div>
            <div className="text-sm font-semibold text-[#F8FAFC] mb-1">
              Historical Trend Detection
            </div>
            <p className="text-xs text-[#94A3B8]">
              OLS linear regressions with Mann-Kendall decadal significance testing.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E293B]/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#64748B]">Metric:</span>
            <span className="text-[#FB923C] font-medium">+1.8°C / decade</span>
          </div>
        </div>

        {/* Feature 2: Annual Heatwave Frequency */}
        <div className="p-4 rounded-lg bg-[#0F172A]/60 border border-[#1E293B] hover:border-[#334155] transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                EVENT CLIMATOLOGY
              </span>
              <BarChart3 className="w-4 h-4 text-[#FB923C]" />
            </div>
            <div className="text-sm font-semibold text-[#F8FAFC] mb-1">
              Annual Frequency &amp; Duration
            </div>
            <p className="text-xs text-[#94A3B8]">
              Cumulative heatwave days, duration distributions, and severity metrics.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E293B]/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#64748B]">Standard:</span>
            <span className="text-[#F8FAFC] font-medium">Tx90p Climatology</span>
          </div>
        </div>

        {/* Feature 3: Data Provenance & Reliability */}
        <div className="p-4 rounded-lg bg-[#0F172A]/60 border border-[#1E293B] hover:border-[#334155] transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                DATA PROVENANCE
              </span>
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            </div>
            <div className="text-sm font-semibold text-[#F8FAFC] mb-1">
              ERA5 Quality Assurance
            </div>
            <p className="text-xs text-[#94A3B8]">
              Copernicus ECMWF atmospheric reanalysis with automated completeness checks.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E293B]/60 flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#64748B]">Grid Quality:</span>
            <span className="text-[#10B981] font-medium">100% Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
