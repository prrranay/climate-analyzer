"use client";

import React, { useMemo, useId, useState } from "react";
import { Grid, AlertCircle, CheckCircle2, Map as MapIcon, ChevronDown, ChevronUp } from "lucide-react";
import { MAX_BBOX_AREA_SQ_DEGREES } from "@/lib/constants";
import { GeographicMap } from "@/components/map/GeographicMap";

export interface BoundingBoxValues {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

interface BoundingBoxInputProps {
  values: BoundingBoxValues;
  onChange: (values: BoundingBoxValues) => void;
  disabled?: boolean;
}

const BBOX_PRESETS: { name: string; values: BoundingBoxValues }[] = [
  {
    name: "Iberian Heat Corridor",
    values: { min_lat: 37.0, max_lat: 40.5, min_lon: -6.0, max_lon: -3.0 },
  },
  {
    name: "Phoenix Metro & Valley",
    values: { min_lat: 32.5, max_lat: 34.5, min_lon: -113.0, max_lon: -111.0 },
  },
  {
    name: "Delhi-NCR Urban Dome",
    values: { min_lat: 28.0, max_lat: 29.5, min_lon: 76.5, max_lon: 78.0 },
  },
  {
    name: "Po Valley, Italy",
    values: { min_lat: 44.5, max_lat: 46.0, min_lon: 9.5, max_lon: 12.5 },
  },
];

export const BoundingBoxInput: React.FC<BoundingBoxInputProps> = ({
  values,
  onChange,
  disabled = false,
}) => {
  const [showMap, setShowMap] = useState(true);
  const minLatId = useId();
  const maxLatId = useId();
  const minLonId = useId();
  const maxLonId = useId();

  const handleChange = (field: keyof BoundingBoxValues, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange({ ...values, [field]: num });
    }
  };

  const { latSpan, lonSpan, area, isValid, validationMessage } = useMemo(() => {
    const latDiff = values.max_lat - values.min_lat;
    const lonDiff = values.max_lon - values.min_lon;
    const computedArea = latDiff > 0 && lonDiff > 0 ? latDiff * lonDiff : 0;

    let valid = true;
    let message = "";

    if (values.min_lat < -90 || values.max_lat > 90) {
      valid = false;
      message = "Latitude coordinates must be within [-90.0, 90.0] degrees.";
    } else if (values.min_lon < -180 || values.max_lon > 180) {
      valid = false;
      message = "Longitude coordinates must be within [-180.0, 180.0] degrees.";
    } else if (values.min_lat >= values.max_lat) {
      valid = false;
      message = "Min latitude (South) must be strictly less than Max latitude (North).";
    } else if (values.min_lon >= values.max_lon) {
      valid = false;
      message = "Min longitude (West) must be strictly less than Max longitude (East).";
    } else if (computedArea > MAX_BBOX_AREA_SQ_DEGREES) {
      valid = false;
      message = `Area (${computedArea.toFixed(2)} deg²) exceeds maximum allowed (${MAX_BBOX_AREA_SQ_DEGREES} deg²).`;
    }

    return { latSpan: latDiff, lonSpan: lonDiff, area: computedArea, isValid: valid, validationMessage: message };
  }, [values]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
          Regional Bounding Box (Max {MAX_BBOX_AREA_SQ_DEGREES} deg²)
        </label>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className="text-[11px] font-mono text-[#FB923C] hover:text-[#F8FAFC] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <MapIcon className="w-3 h-3" />
          <span>{showMap ? "Hide Map" : "Show Map"}</span>
          {showMap ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Preset Regional Hotspot Buttons */}
      <div className="space-y-1">
        <span className="text-[10px] text-[#64748B] font-mono uppercase tracking-wider block">
          Preset Spatial Corridors:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {BBOX_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => onChange(p.values)}
              disabled={disabled}
              className="text-xs px-2.5 py-1 rounded bg-[#0F172A] border border-[#334155] text-[#94A3B8] hover:border-[#475569] hover:text-[#F8FAFC] transition-all cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Leaflet Map for Bounding Box Selection */}
      {showMap && (
        <div className="pt-1">
          <GeographicMap
            mode="bbox"
            bboxValues={values}
            onBboxChange={onChange}
            selectedLocation={null}
            disabled={disabled}
          />
        </div>
      )}

      {/* Accessible Coordinate Input Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={minLatId} className="block text-[11px] font-mono text-[#64748B] mb-1">
            Min Lat (South)
          </label>
          <input
            id={minLatId}
            type="number"
            step="0.01"
            min="-90"
            max="90"
            value={values.min_lat}
            onChange={(e) => handleChange("min_lat", e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-1.5 rounded bg-[#090D16] border border-[#334155] text-xs text-[#F8FAFC] font-mono focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none"
          />
        </div>
        <div>
          <label htmlFor={maxLatId} className="block text-[11px] font-mono text-[#64748B] mb-1">
            Max Lat (North)
          </label>
          <input
            id={maxLatId}
            type="number"
            step="0.01"
            min="-90"
            max="90"
            value={values.max_lat}
            onChange={(e) => handleChange("max_lat", e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-1.5 rounded bg-[#090D16] border border-[#334155] text-xs text-[#F8FAFC] font-mono focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none"
          />
        </div>
        <div>
          <label htmlFor={minLonId} className="block text-[11px] font-mono text-[#64748B] mb-1">
            Min Lon (West)
          </label>
          <input
            id={minLonId}
            type="number"
            step="0.01"
            min="-180"
            max="180"
            value={values.min_lon}
            onChange={(e) => handleChange("min_lon", e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-1.5 rounded bg-[#090D16] border border-[#334155] text-xs text-[#F8FAFC] font-mono focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none"
          />
        </div>
        <div>
          <label htmlFor={maxLonId} className="block text-[11px] font-mono text-[#64748B] mb-1">
            Max Lon (East)
          </label>
          <input
            id={maxLonId}
            type="number"
            step="0.01"
            min="-180"
            max="180"
            value={values.max_lon}
            onChange={(e) => handleChange("max_lon", e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-1.5 rounded bg-[#090D16] border border-[#334155] text-xs text-[#F8FAFC] font-mono focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] outline-none"
          />
        </div>
      </div>

      {/* Real-time Area & Spatial Status */}
      <div
        className={`p-2.5 rounded border text-xs flex items-center justify-between ${
          isValid
            ? "bg-[#0F172A] border-[#334155] text-[#94A3B8]"
            : "bg-rose-950/20 border-rose-500/30 text-rose-300"
        }`}
      >
        <div className="flex items-center gap-2">
          {isValid ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          )}
          <span className="text-[11px]">
            {isValid ? (
              <>
                Spans: <strong className="text-[#F8FAFC] font-mono">{latSpan.toFixed(2)}°</strong> lat ×{" "}
                <strong className="text-[#F8FAFC] font-mono">{lonSpan.toFixed(2)}°</strong> lon ={" "}
                <strong className="text-[#FB923C] font-mono">{area.toFixed(2)} deg²</strong>
              </>
            ) : (
              validationMessage
            )}
          </span>
        </div>
        <Grid className="w-3.5 h-3.5 text-[#64748B]" />
      </div>
    </div>
  );
};
