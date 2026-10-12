import { isBoundingBoxResult, AnalysisResult } from "@/hooks/useHeatwaveAnalysis";

/**
 * Escapes a single CSV value according to RFC 4180:
 * - Null/undefined are formatted as empty string ""
 * - Strings containing commas, double quotes, or newlines are enclosed in double quotes with quotes escaped
 */
export function escapeCsvValue(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an informative, sanitized filename based on target region and temporal window.
 * Example: `heatwave_climatology_phoenix_1991_2020.csv`
 */
export function generateExportFilename(data: AnalysisResult): string {
  const isBbox = isBoundingBoxResult(data);
  const start = data.analysis_window.start_year;
  const end = data.analysis_window.end_year;

  if (isBbox) {
    const minLat = data.bounding_box.min_latitude.toFixed(2);
    const maxLat = data.bounding_box.max_latitude.toFixed(2);
    const minLon = data.bounding_box.min_longitude.toFixed(2);
    const maxLon = data.bounding_box.max_longitude.toFixed(2);
    return `heatwave_bbox_${minLat}_${maxLat}_${minLon}_${maxLon}_${start}_${end}.csv`;
  }

  const rawName = data.location.name || "custom_point";
  const sanitized = rawName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `heatwave_climatology_${sanitized}_${start}_${end}.csv`;
}

/**
 * Converts backend heatwave analysis response into an RFC 4180-compliant CSV string.
 * Strictly preserves null values as empty fields (never converted to 0).
 */
export function generateHeatwaveCsv(data: AnalysisResult): string {
  const isBbox = isBoundingBoxResult(data);

  // 1. Climatological & Metadata Header Comments
  const metadataLines: string[] = [
    `# Climate Hazard Trend Analyzer - Heatwave Climatology Export`,
    `# Upstream Model Source: ${data.data_source.provider} ${data.data_source.dataset} (${data.data_source.resolution})`,
    `# Climatological Baseline: ${data.baseline.baseline_start_year}-${data.baseline.baseline_end_year} (WMO standard)`,
    `# Percentile Threshold: ${data.baseline.percentile_threshold}th percentile (Calendar-Day Moving Window)`,
    `# Min Consecutive Days: ${data.baseline.min_consecutive_days} days`,
    `# Analysis Period: ${data.analysis_window.start_year}-${data.analysis_window.end_year} (${data.analysis_window.total_years} years)`,
  ];

  if (isBbox) {
    metadataLines.push(
      `# Geographic Target: Bounding Box [${data.bounding_box.min_latitude}°, ${data.bounding_box.max_latitude}° lat, ${data.bounding_box.min_longitude}°, ${data.bounding_box.max_longitude}° lon]`
    );
    metadataLines.push(
      `# Spatial Sampling: ${data.spatial_sampling.grid_points_count} points, area ${data.bounding_box.area_square_degrees} deg²`
    );
  } else {
    const locName = [data.location.name, data.location.admin1, data.location.country]
      .filter(Boolean)
      .join(", ");
    metadataLines.push(
      `# Geographic Target: ${locName || "Custom Coordinate"} (${data.location.latitude.toFixed(4)}°, ${data.location.longitude.toFixed(4)}°)`
    );
    if (data.location.elevation !== null) {
      metadataLines.push(`# Elevation: ${data.location.elevation}m`);
    }
  }

  metadataLines.push(
    `# Quality Summary: ${data.data_quality.completeness_percentage.toFixed(1)}% complete (${data.data_quality.observed_days}/${data.data_quality.total_expected_days} days, ${data.data_quality.missing_days} missing)`
  );
  metadataLines.push(`# Export Generated At: ${new Date().toISOString()}`);

  // 2. CSV Column Headers
  const headers = [
    "year",
    "event_count",
    "total_heatwave_days",
    "max_duration_days",
    "mean_duration_days",
    "peak_excess_temperature_celsius",
    "mean_peak_event_temperature_celsius",
    "cumulative_intensity_degree_days",
    "completeness_percentage",
    "usable_days",
    "expected_days",
    "quality_status",
  ];

  // 3. Metric Rows (Preserving nulls as empty cells)
  const rows = data.annual_metrics.map((m) => {
    return [
      escapeCsvValue(m.year),
      escapeCsvValue(m.event_count),
      escapeCsvValue(m.total_heatwave_days),
      escapeCsvValue(m.max_duration_days),
      escapeCsvValue(m.mean_duration_days),
      escapeCsvValue(m.peak_intensity_celsius),
      escapeCsvValue(m.mean_peak_temperature_celsius),
      escapeCsvValue(m.cumulative_intensity_degree_days),
      escapeCsvValue(m.completeness_percentage),
      escapeCsvValue(m.usable_days),
      escapeCsvValue(m.expected_days),
      escapeCsvValue(m.quality_status),
    ].join(",");
  });

  return `${metadataLines.join("\n")}\n${headers.join(",")}\n${rows.join("\n")}\n`;
}

/**
 * Triggers a client-side file download of the generated CSV file.
 */
export function downloadHeatwaveCsv(data: AnalysisResult): void {
  if (typeof window === "undefined") return;

  const csvContent = generateHeatwaveCsv(data);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = generateExportFilename(data);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
