import React from "react";
import { Flame, Compass, Info } from "lucide-react";

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
    </div>
  );
};
