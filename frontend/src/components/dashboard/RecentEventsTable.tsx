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
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-center space-y-2">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
          <Calendar className="w-5 h-5 text-zinc-500" />
        </div>
        <h4 className="text-sm font-semibold text-zinc-200">No Qualifying Heatwave Events Detected</h4>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Zero periods met the criteria (≥3 consecutive days exceeding the calendar-day percentile threshold) during the requested observation window.
        </p>
      </div>
    );
  }

  // Show either top 5 or all 10
  const displayedEvents = isExpanded ? events : events.slice(0, 5);

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-400" />
            Recent Heatwave Events
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Detailed log of the most recent recorded heatwave anomalies
          </p>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          Showing {displayedEvents.length} of {events.length} events
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
              <th className="pb-3 font-semibold">Event Period</th>
              <th className="pb-3 font-semibold">Duration</th>
              <th className="pb-3 font-semibold">Threshold</th>
              <th className="pb-3 font-semibold">Peak Temp</th>
              <th className="pb-3 font-semibold">Peak Exceedance</th>
              <th className="pb-3 font-semibold">Heat Burden</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {displayedEvents.map((evt, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                <td className="py-3 text-zinc-200">
                  <span className="text-orange-400 font-medium">{evt.start_date}</span>
                  <span className="text-zinc-500 mx-1.5">→</span>
                  <span>{evt.end_date}</span>
                </td>
                <td className="py-3 text-zinc-300">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                    <Clock className="w-3 h-3" />
                    {evt.duration_days} days
                  </span>
                </td>
                <td className="py-3 text-zinc-400">
                  {formatNumber(evt.threshold_celsius, 1)}°C
                </td>
                <td className="py-3 text-rose-300 font-bold">
                  {formatNumber(evt.peak_temperature_celsius, 1)}°C
                </td>
                <td className="py-3 text-rose-400">
                  +{formatNumber(evt.peak_exceedance_celsius, 1)}°C
                </td>
                <td className="py-3 text-orange-300">
                  {formatNumber(evt.cumulative_exceedance_degree_days, 1)} °C-days
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {events.length > 5 && (
        <div className="pt-2 text-center border-t border-zinc-800">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Show Fewer Events
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Show All {events.length} Events
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
