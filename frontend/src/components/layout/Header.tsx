"use client";

import React, { useEffect, useState } from "react";
import { Flame, Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

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
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 via-rose-500 to-amber-500 p-0.5 shadow-lg shadow-orange-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center text-orange-400">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Climate Hazard Trend Analyzer
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hidden sm:inline-block">
                ERA5 Reanalysis
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Historical Extreme Event Climatology &amp; Long-Term Trend Detection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border bg-zinc-900/80 border-zinc-800">
            {backendStatus === "checking" && (
              <>
                <Activity className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                <span className="text-zinc-400 hidden xs:inline">Connecting API</span>
              </>
            )}
            {backendStatus === "online" && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Backend Ready</span>
              </>
            )}
            {backendStatus === "offline" && (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400 font-medium">API Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
