"use client";

import React from "react";
import dynamic from "next/dynamic";
import { BoundingBoxValues } from "@/components/filters/BoundingBoxInput";
import { GeoLocationDTO } from "@/types/api";
import { GeographicMode } from "@/components/filters/AnalysisControls";
import { MapPin } from "lucide-react";

interface GeographicMapProps {
  mode: GeographicMode;
  selectedLocation: GeoLocationDTO | null;
  bboxValues: BoundingBoxValues;
  onBboxChange: (newBbox: BoundingBoxValues) => void;
  onPointChange?: (loc: GeoLocationDTO) => void;
  disabled?: boolean;
}

// Client-only dynamic import with fallback skeleton for Next.js App Router
const DynamicMapClient = dynamic(
  () =>
    import("@/components/map/GeographicMapClient").then((mod) => mod.GeographicMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 sm:h-72 w-full rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col items-center justify-center space-y-2 text-zinc-500 text-xs animate-pulse">
        <MapPin className="w-6 h-6 text-zinc-600" />
        <span>Loading Interactive Geographic Map...</span>
      </div>
    ),
  }
);

export const GeographicMap: React.FC<GeographicMapProps> = (props) => {
  return <DynamicMapClient {...props} />;
};
