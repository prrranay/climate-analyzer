"""Deterministic grid generation for geographic bounding box sampling."""

import numpy as np

from app.domain.models import BoundingBox, GeoLocation


def generate_bounding_box_grid(
    box: BoundingBox,
    max_points: int = 9,
) -> list[GeoLocation]:
    """Generate a deterministic regular grid of sample points within a bounding box.

    Guarantees:
    - Never exceeds `max_points`.
    - Coordinates are evenly spaced across the bounding box extent.
    - Each coordinate is rounded to 4 decimal places (~11m spatial precision).
    - Preserves aspect-ratio proportionality between latitude and longitude spans.
    - Sorted deterministically by (latitude, longitude).
    """
    if max_points < 1:
        raise ValueError(f"max_points must be at least 1, got {max_points}")

    # Very small box (< ~5km on each side) collapses to single centroid point
    if max_points == 1 or (box.lat_span < 0.05 and box.lon_span < 0.05):
        centroid_lat = round((box.min_latitude + box.max_latitude) / 2.0, 4)
        centroid_lon = round((box.min_longitude + box.max_longitude) / 2.0, 4)
        return [GeoLocation(latitude=centroid_lat, longitude=centroid_lon)]

    # Determine optimal grid dimensions (n_lat, n_lon) maximizing points <= max_points
    # while matching the aspect ratio (lon_span / lat_span)
    target_aspect = box.lon_span / max(box.lat_span, 1e-6)

    best_r, best_c = 2, 2
    best_diff = float("inf")

    # Explore candidate row and column counts
    for r in range(1, int(np.sqrt(max_points)) + 3):
        for c in range(1, max_points + 1):
            if r * c <= max_points and r * c >= 2:
                aspect = c / r
                diff = abs(aspect - target_aspect)
                # Favor higher point counts that don't exceed max_points
                score = diff - (r * c * 0.01)
                if score < best_diff:
                    best_diff = score
                    best_r, best_c = r, c

    lats = np.linspace(box.min_latitude, box.max_latitude, best_r)
    lons = np.linspace(box.min_longitude, box.max_longitude, best_c)

    points: list[GeoLocation] = []
    seen_keys: set[str] = set()

    for lat in lats:
        for lon in lons:
            rounded_lat = round(float(lat), 4)
            rounded_lon = round(float(lon), 4)
            loc = GeoLocation(latitude=rounded_lat, longitude=rounded_lon)
            if loc.coordinate_key not in seen_keys:
                seen_keys.add(loc.coordinate_key)
                points.append(loc)

    # Sort deterministically
    points.sort(key=lambda p: (p.latitude, p.longitude))
    return points
