"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, Check } from "lucide-react";
import { AnalysisResult } from "@/hooks/useHeatwaveAnalysis";
import { downloadHeatwaveCsv, generateExportFilename } from "@/lib/csvExport";

interface ExportButtonProps {
  data: AnalysisResult;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ data }) => {
  const [downloaded, setDownloaded] = useState(false);

  const handleExport = () => {
    downloadHeatwaveCsv(data);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const filename = generateExportFilename(data);

  return (
    <button
      type="button"
      onClick={handleExport}
      title={`Export dataset as CSV (${filename})`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700/90 text-zinc-200 border border-zinc-700 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 shadow-xs"
    >
      {downloaded ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-300 font-semibold">CSV Downloaded</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5 text-orange-400" />
          <span className="flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
            Export CSV
          </span>
        </>
      )}
    </button>
  );
};
