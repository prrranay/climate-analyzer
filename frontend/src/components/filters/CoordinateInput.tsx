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
        <label className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
          Direct Geographic Coordinates
        </label>
        <span className="text-[10px] text-[#64748B] font-mono">
          WGS84 ([-90, 90] / [-180, 180])
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={latId} className="block text-[11px] font-mono text-[#64748B] mb-1">
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
            className={`w-full px-3 py-1.5 rounded bg-[#090D16] border text-xs text-[#F8FAFC] font-mono outline-none transition-all ${
              isLatValid
                ? "border-[#334155] focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
                : "border-rose-500 text-rose-200"
            }`}
          />
        </div>

        <div>
          <label htmlFor={lonId} className="block text-[11px] font-mono text-[#64748B] mb-1">
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
            className={`w-full px-3 py-1.5 rounded bg-[#090D16] border text-xs text-[#F8FAFC] font-mono outline-none transition-all ${
              isLonValid
                ? "border-[#334155] focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
                : "border-rose-500 text-rose-200"
            }`}
          />
        </div>
      </div>

      {/* Real-time Coordinate Status */}
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
                Target:{" "}
                <strong className="text-[#F8FAFC] font-mono">
                  {currentLat.toFixed(4)}°, {currentLon.toFixed(4)}°
                </strong>{" "}
                (ERA5 0.25° grid)
              </>
            ) : !isLatValid ? (
              "Latitude must be between -90.0 and 90.0 degrees."
            ) : (
              "Longitude must be between -180.0 and 180.0 degrees."
            )}
          </span>
        </div>
        <Navigation className="w-3.5 h-3.5 text-[#64748B]" />
      </div>
    </div>
  );
};
