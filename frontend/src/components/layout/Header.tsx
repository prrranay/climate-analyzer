"use client";

import React, { useEffect, useState } from "react";
import { Flame, Activity, CheckCircle2, AlertTriangle, ExternalLink, Database } from "lucide-react";
import { api } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";

export const Header: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function check() {
      try {
        await api.checkHealth(controller.signal);
        if (isMounted) setBackendStatus("online");
      } catch {
        if (isMounted) setBackendStatus("offline");
      }
    }

    check();
    const interval = setInterval(check, 30000);

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full h-12 bg-[#0F172A] border-b border-[#334155] flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm">
      {/* Brand / Identity Lockup */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-[#F97316]/10 border border-[#F97316]/30 text-[#F97316] shadow-[0_0_12px_-2px_rgba(249,115,22,0.25)]">
          <Flame className="w-4 h-4 fill-[#F97316]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-[#F8FAFC]">
            Climate Hazard Intelligence
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#F97316]/15 text-[#FB923C] border border-[#F97316]/30 tracking-wider uppercase">
            ERA5 Reanalysis
          </span>
        </div>
      </div>

      {/* Center Subtitle or Metadata (visible on larger screens) */}
      <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#94A3B8]">
        <Database className="w-3.5 h-3.5 text-[#F97316]" />
        <span>ECMWF Copernicus Atmospheric Climatology (0.25° Grid)</span>
      </div>

      {/* Trailing Actions & Diagnostics */}
      <div className="flex items-center gap-3">
        {/* Status Pill */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#1E293B] border border-[#334155]">
          {backendStatus === "checking" && (
            <>
              <Activity className="w-3 h-3 text-[#94A3B8] animate-spin" />
              <span className="text-[11px] font-mono text-[#94A3B8]">Connecting API</span>
            </>
          )}
          {backendStatus === "online" && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              </span>
              <span className="text-[11px] font-mono text-[#94A3B8]">Backend Ready</span>
            </>
          )}
          {backendStatus === "offline" && (
            <>
              <AlertTriangle className="w-3 h-3 text-[#ffb4ab]" />
              <span className="text-[11px] font-mono text-[#ffb4ab]">API Disconnected</span>
            </>
          )}
        </div>

        {/* API Docs Button */}
        <a
          href={`${API_BASE_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1E293B] border border-[#334155] text-[11px] font-mono text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#475569] transition-all cursor-pointer"
        >
          <span>API Swagger</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </header>
  );
};
