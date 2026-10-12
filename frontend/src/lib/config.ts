/**
 * Runtime configuration validated at module load time.
 *
 * Uses NEXT_PUBLIC_ prefix so the value is inlined at build time for the
 * browser bundle. Never place secrets in public env vars.
 */

function getEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const clean = value.replace(/\/+$/, ""); // strip trailing slashes

  // Enforce HTTPS for non-local production API communication
  if (
    process.env.NODE_ENV === "production" &&
    clean.startsWith("http://") &&
    !clean.includes("localhost") &&
    !clean.includes("127.0.0.1")
  ) {
    return clean.replace(/^http:\/\//, "https://");
  }

  return clean;
}

/** Validated, trailing-slash-stripped API base URL. */
export const API_BASE_URL = getEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");

/* ------------------------------------------------------------------ */
/*  Constants mirroring backend validation rules                      */
/* ------------------------------------------------------------------ */

/** Earliest year accepted by the backend (ERA5 reanalysis start). */
export const MIN_ANALYSIS_YEAR = 1940;

/** Maximum span the backend will accept in a single request. */
export const MAX_ANALYSIS_RANGE_YEARS = 85;

/** Maximum bounding-box area the backend will accept (sq degrees). */
export const MAX_BBOX_AREA_SQ_DEGREES = 25;

/** Default baseline period used when none is specified. */
export const DEFAULT_BASELINE_START = 1991;
export const DEFAULT_BASELINE_END = 2020;

/** Default analysis model. */
export const DEFAULT_MODEL: "ERA5" | "ERA5_LAND" = "ERA5";
