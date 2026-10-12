import { describe, it, expect } from "vitest";
import {
  MIN_ANALYSIS_YEAR,
  MAX_ANALYSIS_RANGE_YEARS,
  MAX_BBOX_AREA_SQ_DEGREES,
  DEFAULT_BASELINE_START,
  DEFAULT_BASELINE_END,
} from "@/lib/constants";
import { BoundingBoxValues } from "@/components/filters/BoundingBoxInput";

describe("Filter Validation & Boundary Rules", () => {
  const CURRENT_YEAR = new Date().getFullYear();

  describe("Analysis Period Validation", () => {
    function validateAnalysisPeriod(startYear: number, endYear: number): {
      valid: boolean;
      error?: string;
    } {
      if (startYear < MIN_ANALYSIS_YEAR) {
        return {
          valid: false,
          error: `Start year cannot precede minimum allowable year (${MIN_ANALYSIS_YEAR})`,
        };
      }
      if (startYear > endYear) {
        return {
          valid: false,
          error: `Start year cannot be greater than end year`,
        };
      }
      if (endYear > CURRENT_YEAR) {
        return {
          valid: false,
          error: `End year cannot exceed current calendar year (${CURRENT_YEAR})`,
        };
      }
      const span = endYear - startYear + 1;
      if (span > MAX_ANALYSIS_RANGE_YEARS) {
        return {
          valid: false,
          error: `Span of ${span} years exceeds maximum allowable range of ${MAX_ANALYSIS_RANGE_YEARS} years`,
        };
      }
      return { valid: true };
    }

    it("accepts the WMO standard 1991–2020 baseline period", () => {
      const result = validateAnalysisPeriod(1991, 2020);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects start years before ERA5 origin (1940)", () => {
      const result = validateAnalysisPeriod(1930, 2000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("1940");
    });

    it("rejects inverted year ranges where start > end", () => {
      const result = validateAnalysisPeriod(2010, 2000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("greater than end year");
    });

    it("rejects end years exceeding the current calendar year", () => {
      const result = validateAnalysisPeriod(1990, CURRENT_YEAR + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("current calendar year");
    });

    it("rejects query spans exceeding 85 years", () => {
      const result = validateAnalysisPeriod(1940, 2026); // span 87 years > 85
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum allowable range of 85");
    });
  });

  describe("Direct Coordinate Entry Validation", () => {
    function validateCoordinates(lat: number, lon: number): boolean {
      return lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0;
    }

    it("accepts valid global coordinates", () => {
      expect(validateCoordinates(33.4484, -112.074)).toBe(true); // Phoenix
      expect(validateCoordinates(28.6139, 77.209)).toBe(true); // New Delhi
      expect(validateCoordinates(-33.8688, 151.2093)).toBe(true); // Sydney
      expect(validateCoordinates(0, 0)).toBe(true); // Prime Meridian equator
    });

    it("rejects latitudes outside [-90, 90]", () => {
      expect(validateCoordinates(90.1, 0)).toBe(false);
      expect(validateCoordinates(-91.0, 0)).toBe(false);
    });

    it("rejects longitudes outside [-180, 180]", () => {
      expect(validateCoordinates(0, 180.1)).toBe(false);
      expect(validateCoordinates(0, -181.0)).toBe(false);
    });
  });

  describe("Bounding Box Geometry & Area Limits", () => {
    function validateBoundingBox(bbox: BoundingBoxValues): {
      valid: boolean;
      area: number;
      error?: string;
    } {
      if (bbox.min_lat >= bbox.max_lat) {
        return { valid: false, area: 0, error: "min_lat must be strictly less than max_lat" };
      }
      if (bbox.min_lon >= bbox.max_lon) {
        return { valid: false, area: 0, error: "min_lon must be strictly less than max_lon" };
      }
      const latSpan = bbox.max_lat - bbox.min_lat;
      const lonSpan = bbox.max_lon - bbox.min_lon;
      const area = latSpan * lonSpan;
      if (area > MAX_BBOX_AREA_SQ_DEGREES) {
        return {
          valid: false,
          area,
          error: `Area (${area.toFixed(2)} deg²) exceeds maximum allowed limit of ${MAX_BBOX_AREA_SQ_DEGREES} deg²`,
        };
      }
      return { valid: true, area };
    }

    it("accepts valid regional bounding boxes within 25.0 sq degrees", () => {
      const bbox: BoundingBoxValues = {
        min_lat: 32.5,
        max_lat: 34.5,
        min_lon: -113.0,
        max_lon: -111.0,
      }; // 2 * 2 = 4 sq deg
      const result = validateBoundingBox(bbox);
      expect(result.valid).toBe(true);
      expect(result.area).toBe(4);
    });

    it("rejects inverted latitude boundaries", () => {
      const bbox: BoundingBoxValues = {
        min_lat: 40.0,
        max_lat: 35.0,
        min_lon: 10.0,
        max_lon: 12.0,
      };
      const result = validateBoundingBox(bbox);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("min_lat must be strictly less than max_lat");
    });

    it("accepts a bounding box at exactly the 25.0 sq degrees threshold", () => {
      const bbox: BoundingBoxValues = {
        min_lat: 30.0,
        max_lat: 35.0, // 5.0 deg
        min_lon: 10.0,
        max_lon: 15.0, // 5.0 deg -> 25.0 sq deg exactly
      };
      const result = validateBoundingBox(bbox);
      expect(result.valid).toBe(true);
      expect(result.area).toBe(25);
    });

    it("rejects bounding boxes that slightly exceed 25.0 sq degrees threshold", () => {
      const bbox: BoundingBoxValues = {
        min_lat: 30.0,
        max_lat: 35.01, // 5.01 deg
        min_lon: 10.0,
        max_lon: 15.0, // 5.0 deg -> 25.05 sq deg
      };
      const result = validateBoundingBox(bbox);
      expect(result.valid).toBe(false);
      expect(result.area).toBeGreaterThan(25);
    });
  });

  describe("Hazard Scope & Baseline Config", () => {
    it("preserves 1991-2020 as default reference baseline", () => {
      expect(DEFAULT_BASELINE_START).toBe(1991);
      expect(DEFAULT_BASELINE_END).toBe(2020);
    });
  });
});
