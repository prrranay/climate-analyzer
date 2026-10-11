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
        className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider"
      >
        City / Regional Search
      </label>

      {/* Accessible Search Input Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
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
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all disabled:opacity-50"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
          {isLoading && (
            <Loader2
              className="w-4 h-4 text-orange-400 animate-spin"
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
              className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown Results Listbox */}
        {isOpen && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto backdrop-blur-xl"
          >
            {results.length > 0 ? (
              <div className="p-1.5 space-y-0.5">
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
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between group cursor-pointer ${
                        isHighlighted
                          ? "bg-zinc-800 text-zinc-100"
                          : "hover:bg-zinc-850 text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform shrink-0" />
                        <div>
                          <div className="text-sm font-medium">
                            {loc.name || "Unknown Location"}
                            {loc.country && (
                              <span className="text-zinc-400 font-normal ml-1">
                                ({loc.country}
                                {loc.admin1 && loc.admin1 !== loc.name ? `, ${loc.admin1}` : ""})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono">
                            {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°
                            {loc.elevation !== null && loc.elevation !== undefined && (
                              <span className="ml-2 text-zinc-500">Alt: {loc.elevation}m</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-orange-400/80 font-medium">
                        Select
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : query.trim().length >= 2 && !isLoading && !error ? (
              <div className="p-4 text-center text-xs text-zinc-400">
                No matching locations found for &ldquo;{query}&rdquo;
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Geocoding API Error Alert */}
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error.message}</span>
        </div>
      )}

      {/* Active Selected Location Display */}
      {selectedLocation && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-orange-500/10 via-zinc-900/60 to-zinc-900 border border-orange-500/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs uppercase font-semibold text-orange-400 tracking-wider">
                  Selected Target
                </div>
                <div className="text-sm font-bold text-zinc-100">
                  {selectedLocation.name || "Custom Point"}
                  {selectedLocation.country && (
                    <span className="text-zinc-300 font-normal ml-1.5 text-xs">
                      ({selectedLocation.admin1 ? `${selectedLocation.admin1}, ` : ""}
                      {selectedLocation.country})
                    </span>
                  )}
                </div>
                <div className="text-xs text-orange-300/90 font-mono mt-0.5">
                  Lat: {selectedLocation.latitude.toFixed(4)}° | Lon: {selectedLocation.longitude.toFixed(4)}°
                  {selectedLocation.timezone && (
                    <span className="ml-2 text-zinc-400">({selectedLocation.timezone})</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Curated Hotspot Preset Buttons */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
          <Compass className="w-3 h-3 text-orange-400" /> Curated Hotspots:
        </span>
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
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-orange-500/20 border-orange-500 text-orange-300 font-semibold"
                    : "bg-zinc-800/80 hover:bg-zinc-750 border-zinc-700/60 text-zinc-300 hover:text-white"
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
