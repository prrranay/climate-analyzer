"""Deterministic cache key generation with canonical serialization and hashing."""

import hashlib
import json
from typing import Any


def generate_analysis_cache_key(
    latitude: float,
    longitude: float,
    start_year: int,
    end_year: int,
    baseline_start_year: int,
    baseline_end_year: int,
    threshold_percentile: float,
    min_consecutive_days: int = 3,
    threshold_method: str = "climatological_moving_window_15d",
    source: str = "Open-Meteo",
    model: str = "ERA5",
    algorithm_version: str = "v1.0.0",
    dataset_version: str = "v1",
) -> str:
    """Generate deterministic, canonical cache key for climate hazard analysis.

    Canonicalizes every dimension affecting the analysis result:
    - Coordinates rounded to 4 decimal places (~11m precision).
    - Analysis and reference baseline year spans.
    - Climatological threshold method, percentile, and consecutive run-length rule.
    - Meteorological data provider and reanalysis model.
    - Engine algorithm and schema version.
    - Dataset revision/version token from ingestion storage.

    Uses canonical JSON serialization (sorted keys, compact delimiters) and SHA-256
    digest to guarantee bounded key length and collision resistance.
    """
    canonical_lat = round(latitude, 4)
    canonical_lon = round(longitude, 4)

    payload: dict[str, Any] = {
        "algo_version": algorithm_version,
        "baseline": {
            "end_year": baseline_end_year,
            "percentile": round(threshold_percentile, 2),
            "start_year": baseline_start_year,
        },
        "dataset_version": dataset_version,
        "location": {
            "latitude": canonical_lat,
            "longitude": canonical_lon,
        },
        "method": {
            "min_consecutive_days": min_consecutive_days,
            "name": threshold_method,
        },
        "source": {
            "model": model.upper(),
            "provider": source.lower(),
        },
        "window": {
            "end_year": end_year,
            "start_year": start_year,
        },
    }

    # Canonical compact JSON with sorted keys
    canonical_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    digest = hashlib.sha256(canonical_bytes).hexdigest()

    return f"analysis:{canonical_lat:.4f}_{canonical_lon:.4f}:{digest}"


def generate_bbox_cache_key(
    min_latitude: float,
    max_latitude: float,
    min_longitude: float,
    max_longitude: float,
    grid_point_keys: list[str],
    start_year: int,
    end_year: int,
    baseline_start_year: int,
    baseline_end_year: int,
    threshold_percentile: float,
    min_consecutive_days: int = 3,
    threshold_method: str = "climatological_moving_window_15d",
    spatial_aggregation_method: str = "daily_spatial_mean",
    min_point_coverage_ratio: float = 0.60,
    source: str = "Open-Meteo",
    model: str = "ERA5",
    algorithm_version: str = "v1.0.0",
    composite_dataset_version: str = "v1",
) -> str:
    """Generate deterministic, canonical cache key for bounding-box climate hazard analysis.

    Canonicalizes every dimension affecting the regional analysis result:
    - Bounding box limits rounded to 4 decimal places.
    - Deterministic grid sampling coordinates.
    - Composite dataset version derived from all underlying grid point versions.
    - Analysis and reference baseline year spans.
    - Spatial aggregation method and completeness cutoff.
    - Climatological threshold method, percentile, and consecutive run-length rule.
    - Meteorological data provider and reanalysis model.
    - Engine algorithm and schema version.
    """
    c_min_lat = round(min_latitude, 4)
    c_max_lat = round(max_latitude, 4)
    c_min_lon = round(min_longitude, 4)
    c_max_lon = round(max_longitude, 4)

    payload: dict[str, Any] = {
        "algo_version": algorithm_version,
        "baseline": {
            "end_year": baseline_end_year,
            "percentile": round(threshold_percentile, 2),
            "start_year": baseline_start_year,
        },
        "bbox": {
            "max_lat": c_max_lat,
            "max_lon": c_max_lon,
            "min_lat": c_min_lat,
            "min_lon": c_min_lon,
        },
        "composite_dataset_version": composite_dataset_version,
        "grid_points": sorted(grid_point_keys),
        "method": {
            "min_consecutive_days": min_consecutive_days,
            "min_point_coverage_ratio": round(min_point_coverage_ratio, 2),
            "name": threshold_method,
            "spatial_aggregation": spatial_aggregation_method,
        },
        "source": {
            "model": model.upper(),
            "provider": source.lower(),
        },
        "window": {
            "end_year": end_year,
            "start_year": start_year,
        },
    }

    canonical_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    digest = hashlib.sha256(canonical_bytes).hexdigest()

    return f"analysis:bbox:{c_min_lat:.4f}_{c_max_lat:.4f}_{c_min_lon:.4f}_{c_max_lon:.4f}:{digest}"
