"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { Search, MapPin, Loader2, Compass, X, AlertCircle } from "lucide-react";
import { useRegionSearch } from "@/hooks/useRegionSearch";
import { GeoLocationDTO } from "@/types/api";
import { PRESET_REGIONS } from "@/lib/constants";

interface RegionSearchProps {
  selectedLocation: GeoLocationDTO | null;
  onSelectLocation: (location: GeoLocationDTO) => void;
  disabled?: boolean;
}

export const RegionSearch: React.FC<RegionSearchProps> = ({
  selectedLocation,
  onSelectLocation,
  disabled = false,
}) => {
  const { query, setQuery, results, isLoading, error, clearResults } = useRegionSearch();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listboxId = useId();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (loc: GeoLocationDTO) => {
    onSelectLocation(loc);
    setQuery("");
    clearResults();
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setHighlightedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      <label
        htmlFor={inputId}
        className="block text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider"
      >
        CITY / REGIONAL SEARCH
      </label>

      {/* Accessible Search Input Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
          <Search className="w-4 h-4" />
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 ? `${listboxId}-item-${highlightedIndex}` : undefined
          }
          aria-label="Search city or geographic region"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0 || query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type city or state (e.g. Hyderabad, Madrid, Phoenix)..."
          className="w-full pl-9 pr-10 py-2 rounded bg-[#090D16] border border-[#334155] text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] transition-all disabled:opacity-50"
        />
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
          {isLoading && (
            <Loader2
              className="w-4 h-4 text-[#F97316] animate-spin"
              aria-label="Searching regions"
            />
          )}
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                clearResults();
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="text-[#64748B] hover:text-[#F8FAFC] p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Results Listbox */}
        {isOpen && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0F172A] border border-[#334155] rounded shadow-2xl overflow-hidden max-h-72 overflow-y-auto backdrop-blur-xl custom-scrollbar"
          >
            {results.length > 0 ? (
              <div className="p-1 space-y-0.5">
                {results.map((loc, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <button
                      key={`${loc.latitude}-${loc.longitude}-${idx}`}
                      id={`${listboxId}-item-${idx}`}
                      role="option"
                      aria-selected={isHighlighted}
                      type="button"
                      onClick={() => handleSelect(loc)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full text-left px-3 py-2 rounded transition-colors flex items-center justify-between group cursor-pointer ${
                        isHighlighted
                          ? "bg-[#1E293B] text-[#F8FAFC]"
                          : "hover:bg-[#1E293B]/60 text-[#94A3B8]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-[#F8FAFC]">
                            {loc.name || "Unknown Location"}
                            {loc.country && (
                              <span className="text-[#94A3B8] font-normal ml-1">
                                ({loc.country}
                                {loc.admin1 && loc.admin1 !== loc.name ? `, ${loc.admin1}` : ""})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#64748B] font-mono">
                            {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°
                            {loc.elevation !== null && loc.elevation !== undefined && (
                              <span className="ml-1.5 text-[#64748B]">Alt: {loc.elevation}m</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#FB923C] font-mono">
                        Select
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : query.trim().length >= 2 && !isLoading && !error ? (
              <div className="p-3 text-center text-xs text-[#64748B]">
                No matching locations found for &ldquo;{query}&rdquo;
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Geocoding API Error Alert */}
      {error && (
        <div className="p-2.5 rounded bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error.message}</span>
        </div>
      )}

      {/* Active Selected Location Display Plate */}
      {selectedLocation && (
        <div className="bg-[#0F172A] rounded border border-[#F97316]/40 p-3 relative overflow-hidden shadow-sm">
          <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-[#F97316]/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
              <span className="text-[11px] font-semibold text-[#F97316] tracking-wider uppercase">
                SELECTED TARGET
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#64748B]">ERA5 Grid Point</span>
          </div>
          <div className="text-sm font-semibold text-[#F8FAFC]">
            {selectedLocation.name || "Custom Point"}{" "}
            {selectedLocation.country && (
              <span className="font-normal text-xs text-[#94A3B8]">
                ({selectedLocation.admin1 ? `${selectedLocation.admin1}, ` : ""}
                {selectedLocation.country})
              </span>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-[#1E293B] flex flex-col gap-0.5 text-[11px] font-mono text-[#64748B]">
            <div>
              Lat: <span className="text-[#F8FAFC]">{selectedLocation.latitude.toFixed(4)}°</span>
              {" | "}
              Lon: <span className="text-[#F8FAFC]">{selectedLocation.longitude.toFixed(4)}°</span>
            </div>
            {selectedLocation.timezone && (
              <div>Timezone: {selectedLocation.timezone}</div>
            )}
          </div>
        </div>
      )}

      {/* Curated Hotspot Preset Badges */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          <Compass className="w-3 h-3 text-[#F97316]" />
          <span>Curated Hotspots:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_REGIONS.map((preset) => {
            const isSelected =
              selectedLocation &&
              Math.abs(selectedLocation.latitude - preset.latitude) < 0.001 &&
              Math.abs(selectedLocation.longitude - preset.longitude) < 0.001;

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSelect(preset)}
                disabled={disabled}
                className={`px-2.5 py-1 rounded text-xs transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#F97316]/15 text-[#FB923C] border border-[#F97316] font-medium shadow-sm"
                    : "bg-[#0F172A] text-[#94A3B8] border border-[#334155] hover:border-[#475569] hover:text-[#F8FAFC]"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
