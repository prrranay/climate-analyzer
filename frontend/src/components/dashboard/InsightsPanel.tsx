import React from "react";
import { Sparkles } from "lucide-react";

interface InsightsPanelProps {
  insights: string[];
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights }) => {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-[#F97316]/10 via-[#0F172A] to-[#0F172A] border border-[#F97316]/30 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-[#FB923C]">
        <Sparkles className="w-4 h-4 text-[#F97316]" />
        <h3 className="text-xs font-semibold tracking-wide uppercase font-mono">
          Key Climatological Insights
        </h3>
      </div>
      <p className="text-xs text-[#94A3B8]">
        Synthesized directly from backend historical observations and statistical regression tests
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2.5 p-3 rounded-lg bg-[#090D16] border border-[#1E293B] text-xs text-[#F8FAFC] leading-relaxed shadow-xs"
          >
            <div className="w-5 h-5 rounded-full bg-[#F97316]/20 text-[#FB923C] border border-[#F97316]/40 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] font-mono">
              {idx + 1}
            </div>
            <span>{insight}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
