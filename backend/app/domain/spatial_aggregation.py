"""Pure spatial aggregation across sampled grid points to form a regional timeseries."""

from datetime import date

import numpy as np

from app.domain.models import DailyWeatherObservation


def aggregate_grid_daily_series(
    grid_observations: dict[str, list[DailyWeatherObservation]],
    min_coverage_ratio: float = 0.60,
    source_model: str = "ERA5",
) -> tuple[list[DailyWeatherObservation], float]:
    """Aggregate daily observations across spatial grid points into a composite regional series.

    Statistical Strategy:
    1. Collect observations across all N sampled grid points per calendar day.
    2. Filter valid (non-null) maximum temperatures on that day.
    3. Evaluate spatial completeness on day d: valid_points / total_points.
    4. If spatial completeness >= min_coverage_ratio (default 60%), compute the daily
       regional spatial mean: T_max(regional, d) = mean(valid_T_max).
    5. If spatial completeness < min_coverage_ratio, mark day d as missing (None) to prevent
       severely unrepresentative regional estimates from biasing baseline thresholds.

    Returns:
    - Ordered daily series of composite DailyWeatherObservation records.
    - Overall spatial data completeness percentage across all grid points and days.
    """
    total_points = len(grid_observations)
    if total_points == 0:
        return [], 0.0

    # Build date-indexed lookup: date -> list of temp_max floats
    date_measurements: dict[date, list[float | None]] = {}

    for point_obs in grid_observations.values():
        for obs in point_obs:
            if obs.date not in date_measurements:
                date_measurements[obs.date] = []
            date_measurements[obs.date].append(obs.temp_max)

    if not date_measurements:
        return [], 0.0

    sorted_dates = sorted(date_measurements.keys())
    total_point_day_slots = len(sorted_dates) * total_points
    valid_point_day_count = 0

    composite_series: list[DailyWeatherObservation] = []

    for d in sorted_dates:
        measurements = date_measurements[d]
        valid_temps = [t for t in measurements if t is not None]
        valid_point_day_count += len(valid_temps)

        # Fraction of total grid points reporting a valid measurement on date d
        coverage_ratio = len(valid_temps) / total_points

        if coverage_ratio >= min_coverage_ratio and valid_temps:
            regional_mean = round(float(np.mean(valid_temps)), 2)
        else:
            regional_mean = None

        composite_series.append(
            DailyWeatherObservation(
                date=d,
                temp_max=regional_mean,
                unit="°C",
                source_model=source_model,
            )
        )

    spatial_completeness_pct = round(
        (valid_point_day_count / max(total_point_day_slots, 1)) * 100.0, 2
    )

    return composite_series, spatial_completeness_pct
