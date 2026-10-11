import {
  MIN_ANALYSIS_YEAR,
  MAX_ANALYSIS_RANGE_YEARS,
  MAX_BBOX_AREA_SQ_DEGREES,
  DEFAULT_BASELINE_START,
  DEFAULT_BASELINE_END,
  DEFAULT_MODEL,
} from "./config";
import { GeoLocationDTO } from "@/types/api";

export {
  MIN_ANALYSIS_YEAR,
  MAX_ANALYSIS_RANGE_YEARS,
  MAX_BBOX_AREA_SQ_DEGREES,
  DEFAULT_BASELINE_START,
  DEFAULT_BASELINE_END,
  DEFAULT_MODEL,
};

export const CURRENT_YEAR = new Date().getFullYear();
export const DEFAULT_START_YEAR = 1991;
export const DEFAULT_END_YEAR = 2020;
export const DEFAULT_PERCENTILE = 95.0;
export const DEFAULT_MIN_CONSECUTIVE_DAYS = 3;

/**
 * Curated preset cities with geographic diversity and vulnerability to heat extremes.
 */
export const PRESET_REGIONS: (GeoLocationDTO & { label: string })[] = [
  {
    label: "Phoenix, USA",
    name: "Phoenix",
    latitude: 33.4484,
    longitude: -112.074,
    country: "United States",
    country_code: "US",
    admin1: "Arizona",
    elevation: 331,
    timezone: "America/Phoenix",
  },
  {
    label: "Madrid, Spain",
    name: "Madrid",
    latitude: 40.4168,
    longitude: -3.7038,
    country: "Spain",
    country_code: "ES",
    admin1: "Madrid",
    elevation: 657,
    timezone: "Europe/Madrid",
  },
  {
    label: "New Delhi, India",
    name: "New Delhi",
    latitude: 28.6139,
    longitude: 77.209,
    country: "India",
    country_code: "IN",
    admin1: "Delhi",
    elevation: 216,
    timezone: "Asia/Kolkata",
  },
  {
    label: "Tokyo, Japan",
    name: "Tokyo",
    latitude: 35.6895,
    longitude: 139.6917,
    country: "Japan",
    country_code: "JP",
    admin1: "Tokyo",
    elevation: 40,
    timezone: "Asia/Tokyo",
  },
  {
    label: "Sydney, Australia",
    name: "Sydney",
    latitude: -33.8688,
    longitude: 151.2093,
    country: "Australia",
    country_code: "AU",
    admin1: "New South Wales",
    elevation: 58,
    timezone: "Australia/Sydney",
  },
  {
    label: "London, UK",
    name: "London",
    latitude: 51.5074,
    longitude: -0.1278,
    country: "United Kingdom",
    country_code: "GB",
    admin1: "England",
    elevation: 25,
    timezone: "Europe/London",
  },
];

export const HAZARDS = [
  {
    id: "heatwave",
    name: "Heatwave",
    description: "Multi-day extreme temperature anomalies above historical thresholds",
    active: true,
  },
  {
    id: "cold_spell",
    name: "Cold Spell",
    description: "Consecutive extreme cold temperature anomalies (Coming soon)",
    active: false,
  },
  {
    id: "drought",
    name: "Drought",
    description: "Extended precipitation deficiency anomalies (Coming soon)",
    active: false,
  },
];
