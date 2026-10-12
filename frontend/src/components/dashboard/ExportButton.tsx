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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1E293B] hover:bg-[#1E293B]/80 text-[#F8FAFC] border border-[#334155] hover:border-[#475569] text-xs font-mono transition-all cursor-pointer shadow-xs active:scale-95"
    >
      {downloaded ? (
        <>
          <Check className="w-3.5 h-3.5 text-[#10B981]" />
          <span className="text-[#10B981] font-medium">Downloaded</span>
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5 text-[#FB923C]" />
          <span className="flex items-center gap-1 text-[#94A3B8]">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#64748B]" />
            Export CSV
          </span>
        </>
      )}
    </button>
  );
};
