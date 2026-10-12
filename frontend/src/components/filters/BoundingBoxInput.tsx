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
    values: { min_lat: 37.0, max_lat: 40.5, min_lon: -6.0, max_lon: -3.0 }, // 3.5 * 3 = 10.5 sq deg
  },
  {
    name: "Phoenix Metro & Valley",
    values: { min_lat: 32.5, max_lat: 34.5, min_lon: -113.0, max_lon: -111.0 }, // 2 * 2 = 4 sq deg
  },
  {
    name: "Delhi-NCR Urban Heat Dome",
    values: { min_lat: 28.0, max_lat: 29.5, min_lon: 76.5, max_lon: 78.0 }, // 1.5 * 1.5 = 2.25 sq deg
  },
  {
    name: "Po Valley, Italy",
    values: { min_lat: 44.5, max_lat: 46.0, min_lon: 9.5, max_lon: 12.5 }, // 1.5 * 3 = 4.5 sq deg
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
      message = "Max Latitude (North) must be strictly greater than Min Latitude (South).";
    } else if (values.min_lon >= values.max_lon) {
      valid = false;
      message = "Max Longitude (East) must be strictly greater than Min Longitude (West).";
    } else if (computedArea > MAX_BBOX_AREA_SQ_DEGREES) {
      valid = false;
      message = `Area (${computedArea.toFixed(2)} deg²) exceeds the maximum backend limit of ${MAX_BBOX_AREA_SQ_DEGREES} deg².`;
    }

    return {
      latSpan: latDiff,
      lonSpan: lonDiff,
      area: computedArea,
      isValid: valid,
      validationMessage: message,
    };
  }, [values]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Geographic Bounding Box
        </label>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 rounded px-1"
        >
          <MapIcon className="w-3 h-3" />
          <span>{showMap ? "Hide Map" : "Show Map"}</span>
          {showMap ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Preset Bounding Boxes */}
      <div className="space-y-1">
        <span className="text-[11px] text-zinc-400 font-medium">Quick Regional Presets:</span>
        <div className="flex flex-wrap gap-1.5">
          {BBOX_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => onChange(p.values)}
              disabled={disabled}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-750 border border-zinc-700/60 text-zinc-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={minLatId} className="block text-xs text-zinc-400 mb-1">
            Min Latitude (South)
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
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 font-mono focus:ring-1 focus:ring-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor={maxLatId} className="block text-xs text-zinc-400 mb-1">
            Max Latitude (North)
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
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 font-mono focus:ring-1 focus:ring-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor={minLonId} className="block text-xs text-zinc-400 mb-1">
            Min Longitude (West)
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
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 font-mono focus:ring-1 focus:ring-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor={maxLonId} className="block text-xs text-zinc-400 mb-1">
            Max Longitude (East)
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
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 font-mono focus:ring-1 focus:ring-orange-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Real-time Area & Spatial Status */}
      <div
        className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
          isValid
            ? "bg-zinc-900/60 border-zinc-800 text-zinc-300"
            : "bg-rose-950/20 border-rose-500/30 text-rose-300"
        }`}
      >
        <div className="flex items-center gap-2">
          {isValid ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>
            {isValid ? (
              <>
                Spans: <strong className="text-zinc-100 font-mono">{latSpan.toFixed(2)}°</strong> lat ×{" "}
                <strong className="text-zinc-100 font-mono">{lonSpan.toFixed(2)}°</strong> lon ={" "}
                <strong className="text-orange-400 font-mono">{area.toFixed(2)} deg²</strong>
              </>
            ) : (
              validationMessage
            )}
          </span>
        </div>
        <Grid className="w-4 h-4 text-zinc-500" />
      </div>
    </div>
  );
};
