import React from "react";
import { Database, ShieldCheck, ExternalLink } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full h-9 bg-[#0F172A] border-t border-[#334155] px-4 flex items-center justify-between shrink-0 z-30 text-[11px] font-mono text-[#64748B]">
      {/* Provenance Badges */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[#94A3B8]">
          <Database className="w-3.5 h-3.5 text-[#64748B]" />
          <span>ECMWF ERA5 Reanalysis (0.25° grid via Open-Meteo)</span>
        </div>
        <span className="text-[#334155] hidden md:inline">|</span>
        <div className="hidden md:flex items-center gap-1.5 text-[#94A3B8]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
          <span>Quality-controlled &amp; provisional year awareness</span>
        </div>
      </div>

      {/* Right System Specs and Reference Links */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-[#64748B]">FastAPI + MongoDB + Redis</span>
        <span className="text-[#334155] hidden sm:inline">•</span>
        <a
          href={`${API_BASE_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[#FB923C] hover:underline transition-colors"
        >
          <span>API Swagger</span>
          <ExternalLink className="w-3 h-3" />
        </a>
        <span className="text-[#334155]">|</span>
        <span className="text-[#64748B]">v1.0.0</span>
      </div>
    </footer>
  );
};
