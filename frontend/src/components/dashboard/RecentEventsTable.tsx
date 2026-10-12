import React, { useState } from "react";
import { HeatwaveEventDTO } from "@/types/api";
import { formatNumber } from "@/lib/utils";
import { Calendar, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface RecentEventsTableProps {
  events: HeatwaveEventDTO[];
}

export const RecentEventsTable: React.FC<RecentEventsTableProps> = ({ events }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!events || events.length === 0) {
    return (
      <div className="p-5 rounded-xl bg-[#0F172A] border border-[#334155] text-center space-y-2">
        <div className="w-8 h-8 rounded bg-[#1E293B] text-[#94A3B8] flex items-center justify-center mx-auto">
          <Calendar className="w-4 h-4 text-[#64748B]" />
        </div>
        <h4 className="text-xs font-semibold text-[#F8FAFC]">No Qualifying Heatwave Events Detected</h4>
        <p className="text-xs text-[#64748B] max-w-md mx-auto">
          Zero periods met the criteria (≥3 consecutive days exceeding the calendar-day percentile threshold) during the requested observation window.
        </p>
      </div>
    );
  }

  // Show either top 5 or all 10
  const displayedEvents = isExpanded ? events : events.slice(0, 5);

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[#0F172A] border border-[#334155] space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F8FAFC] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#F97316]" />
            Recent Heatwave Events
          </h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Detailed log of recorded heatwave anomalies
          </p>
        </div>
        <span className="text-xs text-[#64748B] font-mono">
          Showing {displayedEvents.length} of {events.length} events
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#334155] text-[#64748B] font-medium text-[11px]">
              <th className="pb-2.5 font-semibold">Event Period</th>
              <th className="pb-2.5 font-semibold">Duration</th>
              <th className="pb-2.5 font-semibold">Threshold</th>
              <th className="pb-2.5 font-semibold">Peak Temp</th>
              <th className="pb-2.5 font-semibold">Peak Exceedance</th>
              <th className="pb-2.5 font-semibold">Heat Burden</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B] font-mono text-[11px]">
            {displayedEvents.map((evt, idx) => (
              <tr key={idx} className="hover:bg-[#1E293B]/40 transition-colors">
                <td className="py-2.5 font-medium text-[#F8FAFC]">
                  {evt.start_date} → {evt.end_date}
                </td>
                <td className="py-2.5 text-[#FB923C] font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#F97316]" />
                    {evt.duration_days} days
                  </span>
                </td>
                <td className="py-2.5 text-[#94A3B8]">
                  {formatNumber(evt.threshold_celsius, 1)}°C
                </td>
                <td className="py-2.5 text-[#F8FAFC] font-semibold">
                  {formatNumber(evt.peak_temperature_celsius, 1)}°C
                </td>
                <td className="py-2.5 text-rose-400 font-semibold">
                  +{formatNumber(evt.peak_exceedance_celsius, 1)}°C
                </td>
                <td className="py-2.5 text-[#94A3B8]">
                  {formatNumber(evt.cumulative_exceedance_degree_days, 1)} °C·d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {events.length > 5 && (
        <div className="pt-2 border-t border-[#1E293B] flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC] text-xs font-mono transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <>
                <span>Show Fewer</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Show All {events.length} Events</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
