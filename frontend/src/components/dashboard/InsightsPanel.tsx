import React from "react";
import { Sparkles } from "lucide-react";

interface InsightsPanelProps {
  insights: string[];
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights }) => {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500/10 via-zinc-900/60 to-zinc-900/80 border border-orange-500/30 backdrop-blur-md space-y-3">
      <div className="flex items-center gap-2 text-orange-400">
        <Sparkles className="w-4 h-4" />
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          Key Climatological Insights
        </h3>
      </div>
      <p className="text-xs text-zinc-400">
        Synthesized directly from backend historical observations and regression tests
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-200 leading-relaxed shadow-sm"
          >
            <div className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
              {idx + 1}
            </div>
            <span>{insight}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
