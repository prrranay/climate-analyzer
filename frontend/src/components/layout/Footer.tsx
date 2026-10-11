import React from "react";
import { Database, ShieldCheck, ExternalLink } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950/60 mt-16 text-zinc-500 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-zinc-400" />
            <span>ECMWF ERA5 Reanalysis (0.25° resolution via Open-Meteo)</span>
          </div>
          <div className="flex items-center gap-2 hidden sm:flex">
            <ShieldCheck className="w-4 h-4 text-emerald-400/80" />
            <span>Quality-controlled &amp; provisional year awareness</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-zinc-400">
          <span>FastAPI + MongoDB + Redis Cache</span>
          <span>•</span>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-200 transition-colors inline-flex items-center gap-1"
          >
            API Swagger <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </footer>
  );
};
