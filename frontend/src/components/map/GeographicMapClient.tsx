"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BoundingBoxValues } from "@/components/filters/BoundingBoxInput";
import { GeoLocationDTO } from "@/types/api";
import { GeographicMode } from "@/components/filters/AnalysisControls";
import { MAX_BBOX_AREA_SQ_DEGREES } from "@/lib/constants";
import { MapPin, Crosshair, AlertTriangle, ShieldAlert } from "lucide-react";

interface GeographicMapClientProps {
  mode: GeographicMode;
  selectedLocation: GeoLocationDTO | null;
  bboxValues: BoundingBoxValues;
  onBboxChange: (newBbox: BoundingBoxValues) => void;
  onPointChange?: (loc: GeoLocationDTO) => void;
  disabled?: boolean;
}

export const GeographicMapClient: React.FC<GeographicMapClientProps> = ({
  mode,
  selectedLocation,
  bboxValues,
  onBboxChange,
  onPointChange,
  disabled = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const rectangleRef = useRef<L.Rectangle | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [drawMode, setDrawMode] = useState<"view" | "firstCorner" | "ready">("view");
  const [firstCorner, setFirstCorner] = useState<L.LatLng | null>(null);

  // Calculate bounding box area
  const latSpan = Math.abs(bboxValues.max_lat - bboxValues.min_lat);
  const lonSpan = Math.abs(bboxValues.max_lon - bboxValues.min_lon);
  const area = latSpan * lonSpan;
  const isAreaExceeded = area > MAX_BBOX_AREA_SQ_DEGREES;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent multiple initializations

    // Center on selected location or bbox center
    const initialLat = mode === "bbox" ? (bboxValues.min_lat + bboxValues.max_lat) / 2 : selectedLocation?.latitude ?? 33.45;
    const initialLon = mode === "bbox" ? (bboxValues.min_lon + bboxValues.max_lon) / 2 : selectedLocation?.longitude ?? -112.07;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: mode === "bbox" ? 6 : 7,
      zoomControl: true,
      attributionControl: true,
    });

    // Open-source OpenStreetMap tiles (free, public, no API key required) styled with dark-mode filter
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      subdomains: ["a", "b", "c"],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Sync Bounding Box Rectangle on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (mode === "bbox") {
      // Remove marker if any
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      const bounds = L.latLngBounds(
        [bboxValues.min_lat, bboxValues.min_lon],
        [bboxValues.max_lat, bboxValues.max_lon]
      );

      const color = isAreaExceeded ? "#ef4444" : "#f97316";

      if (rectangleRef.current) {
        rectangleRef.current.setBounds(bounds);
        rectangleRef.current.setStyle({
          color,
          fillColor: color,
        });
      } else {
        const rect = L.rectangle(bounds, {
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.2,
          dashArray: isAreaExceeded ? "4 4" : undefined,
        }).addTo(map);

        rectangleRef.current = rect;
      }

      // Fly to bounds if rectangle changed significantly
      if (drawMode === "view") {
        map.fitBounds(bounds, { padding: [25, 25], maxZoom: 8, animate: true });
      }
    } else {
      // Remove rectangle in point mode
      if (rectangleRef.current) {
        rectangleRef.current.remove();
        rectangleRef.current = null;
      }

      // Sync Point Marker
      if (selectedLocation) {
        const latLng = L.latLng(selectedLocation.latitude, selectedLocation.longitude);

        // Custom styled SVG pin
        const customPinIcon = L.divIcon({
          className: "custom-climate-pin",
          html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:rgba(249,115,22,0.9);border:2px solid #ffffff;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.5);color:#fff;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -28],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng(latLng);
        } else {
          const marker = L.marker(latLng, { icon: customPinIcon }).addTo(map);
          markerRef.current = marker;
        }

        markerRef.current
          .bindPopup(
            `<div style="font-family:inherit;font-size:12px;padding:2px;">
              <strong style="color:#09090b;">${selectedLocation.name || "Target Point"}</strong><br/>
              <span style="color:#52525b;font-family:monospace;">${selectedLocation.latitude.toFixed(4)}°, ${selectedLocation.longitude.toFixed(4)}°</span>
            </div>`
          )
          .openPopup();

        map.setView(latLng, 8, { animate: true });
      }
    }
  }, [mode, bboxValues, selectedLocation, isAreaExceeded, drawMode]);

  // Handle map click events for drawing or recentering
  const handleMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (disabled) return;

      if (mode === "bbox") {
        if (drawMode === "firstCorner" && firstCorner) {
          // Set second corner to complete the box
          const secondCorner = e.latlng;
          const minLat = Math.min(firstCorner.lat, secondCorner.lat);
          const maxLat = Math.max(firstCorner.lat, secondCorner.lat);
          const minLon = Math.min(firstCorner.lng, secondCorner.lng);
          const maxLon = Math.max(firstCorner.lng, secondCorner.lng);

          // Round to 4 decimal places
          onBboxChange({
            min_lat: Math.round(minLat * 10000) / 10000,
            max_lat: Math.round(maxLat * 10000) / 10000,
            min_lon: Math.round(minLon * 10000) / 10000,
            max_lon: Math.round(maxLon * 10000) / 10000,
          });

          setFirstCorner(null);
          setDrawMode("view");
        } else if (drawMode === "ready") {
          // Record first corner
          setFirstCorner(e.latlng);
          setDrawMode("firstCorner");
        } else {
          // When in view mode, clicking recenters a standard 1.5° x 1.5° bounding box on clicked point
          const centerLat = e.latlng.lat;
          const centerLon = e.latlng.lng;
          const halfSpan = 0.75; // 1.5 deg span = 2.25 deg² area (well under 25 deg² limit)

          onBboxChange({
            min_lat: Math.max(-90, Math.round((centerLat - halfSpan) * 10000) / 10000),
            max_lat: Math.min(90, Math.round((centerLat + halfSpan) * 10000) / 10000),
            min_lon: Math.max(-180, Math.round((centerLon - halfSpan) * 10000) / 10000),
            max_lon: Math.min(180, Math.round((centerLon + halfSpan) * 10000) / 10000),
          });
        }
      } else if (mode === "coordinates" && onPointChange) {
        // Point selection by clicking on map
        onPointChange({
          latitude: Math.round(e.latlng.lat * 10000) / 10000,
          longitude: Math.round(e.latlng.lng * 10000) / 10000,
          name: "Map Selected Coordinate",
          country: null,
          country_code: null,
          admin1: null,
          elevation: null,
          timezone: "UTC",
        });
      }
    },
    [disabled, mode, drawMode, firstCorner, onBboxChange, onPointChange]
  );

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [handleMapClick]);

  return (
    <div className="space-y-3">
      {/* Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#F8FAFC] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
            Geographic Boundary Map
          </span>
          {mode === "bbox" && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                isAreaExceeded
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              }`}
            >
              Area: {area.toFixed(2)} deg² {isAreaExceeded ? "(Limit: 25 deg² Exceeded)" : "(Valid)"}
            </span>
          )}
        </div>

        {mode === "bbox" && !disabled && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (drawMode === "ready" || drawMode === "firstCorner") {
                  setDrawMode("view");
                  setFirstCorner(null);
                } else {
                  setDrawMode("ready");
                }
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                drawMode !== "view"
                  ? "bg-[#F97316]/20 text-[#FB923C] border-[#F97316]/40"
                  : "bg-[#1E293B] text-[#94A3B8] border-[#334155] hover:text-[#F8FAFC]"
              }`}
            >
              <Crosshair className="w-3 h-3" />
              {drawMode === "ready"
                ? "Click 1st Corner on Map"
                : drawMode === "firstCorner"
                ? "Click 2nd Corner on Map"
                : "Draw Custom Box"}
            </button>
          </div>
        )}
      </div>

      {/* Map Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-[#334155] shadow-md">
        <div ref={mapContainerRef} className="h-64 sm:h-72 w-full z-0 bg-[#090D16]" />

        {/* Draw mode banner */}
        {drawMode !== "view" && (
          <div className="absolute top-2 left-2 right-2 z-1000 p-2 rounded-lg bg-[#0F172A]/90 border border-[#F97316]/40 text-xs text-[#FB923C] backdrop-blur-md flex items-center justify-between shadow-lg">
            <span>
              {drawMode === "ready"
                ? "Step 1: Click the map to place the first corner of your bounding box."
                : "Step 2: Click the map to place the opposite corner."}
            </span>
            <button
              type="button"
              onClick={() => {
                setDrawMode("view");
                setFirstCorner(null);
              }}
              className="text-[11px] underline text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer ml-2"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Accessible Non-Map Coordinates Summary */}
      <div className="p-3 rounded-lg bg-[#0F172A] border border-[#334155] text-xs space-y-1.5 font-mono">
        <div className="text-[11px] text-[#94A3B8] font-sans font-medium flex items-center justify-between">
          <span>Active Bounding Box Coordinates (Accessible Representation):</span>
          {isAreaExceeded && (
            <span className="text-rose-400 flex items-center gap-1 font-sans text-[11px]">
              <AlertTriangle className="w-3 h-3" /> Area exceeds 25 deg² limit
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[#94A3B8] text-[11px]">
          <div>
            <span className="text-[#64748B]">South (Min Lat):</span> {bboxValues.min_lat.toFixed(4)}°
          </div>
          <div>
            <span className="text-[#64748B]">North (Max Lat):</span> {bboxValues.max_lat.toFixed(4)}°
          </div>
          <div>
            <span className="text-[#64748B]">West (Min Lon):</span> {bboxValues.min_lon.toFixed(4)}°
          </div>
          <div>
            <span className="text-[#64748B]">East (Max Lon):</span> {bboxValues.max_lon.toFixed(4)}°
          </div>
        </div>
      </div>

      {/* Climatological Resolution Disclaimer */}
      <div className="p-2.5 rounded-lg bg-[#0F172A]/40 border border-[#1E293B] text-[11px] text-[#64748B] flex items-start gap-2">
        <ShieldAlert className="w-3.5 h-3.5 text-[#64748B] shrink-0 mt-0.5" />
        <span>
          <strong className="text-[#94A3B8]">Scientific Spatial Scope:</strong> The regional analysis aggregates an ERA5 atmospheric grid
          (0.25° resolution, up to 9 sample points for boxes ≤ 25 deg²). It does not provide high-resolution local micro-climate modeling.
        </span>
      </div>
    </div>
  );
};
