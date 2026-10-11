import { QualityStatus, TrendDirection } from "@/types/api";

/** Simple className joiner */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}

/** Formats a decimal number with given decimals, strictly preserving null as fallback */
export function formatNumber(
  val: number | null | undefined,
  decimals: number = 2,
  fallback: string = "N/A"
): string {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return Number(val).toFixed(decimals);
}

/**
 * Formats a linear regression slope rate.
 * Critical: A numeric zero slope must be formatted as "0.00", NOT as "N/A" or missing.
 */
export function formatSlope(
  val: number | null | undefined,
  decimals: number = 2,
  fallback: string = "N/A"
): string {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  if (val === 0) return (0).toFixed(decimals);
  const prefix = val > 0 ? "+" : "";
  return `${prefix}${Number(val).toFixed(decimals)}`;
}

/** Formats temperature values explicitly in Celsius (°C) */
export function formatTemperature(
  celsius: number | null | undefined,
  decimals: number = 1,
  fallback: string = "N/A"
): string {
  if (celsius === null || celsius === undefined || isNaN(celsius)) return fallback;
  return `${Number(celsius).toFixed(decimals)}°C`;
}

/** Formats degree-days thermal intensity explicitly in °C-days */
export function formatDegreeDays(
  degreeDays: number | null | undefined,
  decimals: number = 1,
  fallback: string = "N/A"
): string {
  if (degreeDays === null || degreeDays === undefined || isNaN(degreeDays)) return fallback;
  return `${Number(degreeDays).toFixed(decimals)} °C-days`;
}

/** Formats a percentage value (0 to 100) */
export function formatPercent(
  val: number | null | undefined,
  decimals: number = 1,
  fallback: string = "N/A"
): string {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return `${Number(val).toFixed(decimals)}%`;
}

/** Formats p-values in standard scientific or threshold notation */
export function formatPValue(pValue: number | null | undefined): string {
  if (pValue === null || pValue === undefined || isNaN(pValue)) return "N/A";
  if (pValue < 0.001) return "< 0.001 (High Sig.)";
  if (pValue < 0.01) return `${pValue.toFixed(3)} (p < 0.01)`;
  if (pValue < 0.05) return `${pValue.toFixed(3)} (p < 0.05)`;
  return `${pValue.toFixed(3)} (Not sig.)`;
}

/** Quality status badge configuration */
export function getQualityStatusBadge(status: QualityStatus): {
  label: string;
  className: string;
  description: string;
} {
  switch (status) {
    case "reliable":
      return {
        label: "Reliable",
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        description: "Meets high completeness criteria (≥90% valid days, no critical streaks)",
      };
    case "provisional":
      return {
        label: "Provisional",
        className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        description: "Current calendar year is ongoing; metrics are provisional & excluded from regression",
      };
    case "incomplete":
      return {
        label: "Incomplete",
        className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        description: "Data completeness is degraded or has missing observation gaps",
      };
    case "insufficient_data":
      return {
        label: "Insufficient Data",
        className: "bg-red-500/10 text-red-400 border-red-500/20",
        description: "Severe missing data (<50% observed); excluded from trend regression",
      };
    default:
      return {
        label: status,
        className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
        description: "Unknown quality status",
      };
  }
}

/** Trend direction styling and human label */
export function getTrendDirectionBadge(
  direction: TrendDirection,
  isSignificant: boolean
): {
  label: string;
  className: string;
  iconName: "TrendingUp" | "TrendingDown" | "Minus" | "HelpCircle";
} {
  switch (direction) {
    case "increasing":
      return {
        label: isSignificant ? "Statistically Increasing" : "Upward (Non-sig)",
        className: isSignificant
          ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
          : "bg-amber-500/15 text-amber-400 border-amber-500/30",
        iconName: "TrendingUp",
      };
    case "decreasing":
      return {
        label: isSignificant ? "Statistically Decreasing" : "Downward (Non-sig)",
        className: isSignificant
          ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
          : "bg-blue-500/15 text-blue-400 border-blue-500/30",
        iconName: "TrendingDown",
      };
    case "stable":
      return {
        label: "Stable",
        className: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
        iconName: "Minus",
      };
    case "indeterminate":
    default:
      return {
        label: "Indeterminate",
        className: "bg-zinc-700/30 text-zinc-400 border-zinc-700/50",
        iconName: "HelpCircle",
      };
  }
}
