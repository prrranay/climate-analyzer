import React from "react";
import { Flame, Compass } from "lucide-react";

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
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40 backdrop-blur-sm">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center mb-4 text-orange-400">
        <Flame className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-100 mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
        {description}
      </p>
      {onSelectPreset && (
        <button
          onClick={onSelectPreset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 transition-all cursor-pointer"
        >
          <Compass className="w-4 h-4" />
          Load Example (Phoenix, AZ)
        </button>
      )}
    </div>
  );
};
