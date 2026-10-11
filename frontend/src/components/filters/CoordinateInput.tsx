"use client";

import React, { useId } from "react";
import { Navigation, AlertCircle, CheckCircle2 } from "lucide-react";
import { GeoLocationDTO } from "@/types/api";

interface CoordinateInputProps {
  location: GeoLocationDTO | null;
  onChangeLocation: (location: GeoLocationDTO) => void;
  disabled?: boolean;
}

export const CoordinateInput: React.FC<CoordinateInputProps> = ({
  location,
  onChangeLocation,
  disabled = false,
}) => {
  const latId = useId();
  const lonId = useId();

  const currentLat = location ? location.latitude : 0;
  const currentLon = location ? location.longitude : 0;

  const isLatValid = currentLat >= -90.0 && currentLat <= 90.0;
  const isLonValid = currentLon >= -180.0 && currentLon <= 180.0;
  const isValid = isLatValid && isLonValid;

  const handleLatChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChangeLocation({
        latitude: num,
        longitude: currentLon,
        name: location?.name || "Custom Point",
        country: location?.country || null,
        country_code: location?.country_code || null,
        admin1: location?.admin1 || null,
        elevation: location?.elevation || null,
        timezone: location?.timezone || "UTC",
      });
    }
  };

  const handleLonChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChangeLocation({
        latitude: currentLat,
        longitude: num,
        name: location?.name || "Custom Point",
        country: location?.country || null,
        country_code: location?.country_code || null,
        admin1: location?.admin1 || null,
        elevation: location?.elevation || null,
        timezone: location?.timezone || "UTC",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Direct Geographic Coordinates
        </label>
        <span className="text-[11px] text-zinc-400 font-mono">
          WGS84 ([-90, 90] / [-180, 180])
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={latId} className="block text-xs text-zinc-400 mb-1">
            Latitude (°N / °S)
          </label>
          <input
            id={latId}
            type="number"
            step="0.0001"
            min="-90"
            max="90"
            value={location ? currentLat : ""}
            onChange={(e) => handleLatChange(e.target.value)}
            disabled={disabled}
            placeholder="e.g. 33.4484"
            className={`w-full px-3 py-2 rounded-lg bg-zinc-900 border text-sm text-zinc-100 font-mono focus:outline-none transition-all ${
              isLatValid
                ? "border-zinc-700 focus:ring-1 focus:ring-orange-500"
                : "border-rose-500 focus:ring-1 focus:ring-rose-500 text-rose-200"
            }`}
          />
        </div>

        <div>
          <label htmlFor={lonId} className="block text-xs text-zinc-400 mb-1">
            Longitude (°E / °W)
          </label>
          <input
            id={lonId}
            type="number"
            step="0.0001"
            min="-180"
            max="180"
            value={location ? currentLon : ""}
            onChange={(e) => handleLonChange(e.target.value)}
            disabled={disabled}
            placeholder="e.g. -112.074"
            className={`w-full px-3 py-2 rounded-lg bg-zinc-900 border text-sm text-zinc-100 font-mono focus:outline-none transition-all ${
              isLonValid
                ? "border-zinc-700 focus:ring-1 focus:ring-orange-500"
                : "border-rose-500 focus:ring-1 focus:ring-rose-500 text-rose-200"
            }`}
          />
        </div>
      </div>

      {/* Real-time Coordinate Status */}
      <div
        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
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
                Target:{" "}
                <strong className="text-zinc-100 font-mono">
                  {currentLat.toFixed(4)}°, {currentLon.toFixed(4)}°
                </strong>{" "}
                (will be evaluated via ERA5 0.25° grid)
              </>
            ) : !isLatValid ? (
              "Latitude must be between -90.0 and 90.0 degrees."
            ) : (
              "Longitude must be between -180.0 and 180.0 degrees."
            )}
          </span>
        </div>
        <Navigation className="w-3.5 h-3.5 text-zinc-500" />
      </div>
    </div>
  );
};
