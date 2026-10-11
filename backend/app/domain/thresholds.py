"""Pure functions for computing climatological baseline temperature thresholds."""

from collections import defaultdict
from datetime import date, timedelta
from typing import Final

import numpy as np

from app.domain.models import BaselineConfig, DailyWeatherObservation

# Reference leap year for constructing continuous circular calendar offsets
_REFERENCE_LEAP_YEAR: Final[int] = 2000


def calculate_calendar_day_thresholds(
    baseline_observations: list[DailyWeatherObservation],
    baseline_config: BaselineConfig,
    window_radius_days: int = 7,
    min_samples_threshold: int = 15,
) -> dict[tuple[int, int], float]:
    """Calculate calendar-day 95th-percentile thresholds using a centered moving window.

    Scientific methodology:
    - Target baseline years: strictly constrained to [baseline_config.baseline_start_year,
      baseline_config.baseline_end_year].
    - Moving window: ±7 calendar days centered on each calendar day (15-day moving window).
    - Circular calendar wraparound: December-to-January transitions are seamlessly resolved.
    - Feb 29 (leap day): fully supported with its own ±7 day centered window.
    - Percentile: strictly derived from baseline data only, using NumPy linear percentile.

    Args:
        baseline_observations: Historical daily weather records.
        baseline_config: Climatological baseline specifications.
        window_radius_days: Half-width of centered window (default ±7 days, total 15 days).
        min_samples_threshold: Minimum valid observations required in window pool.

    Returns:
        Dictionary mapping (month, day) -> threshold in °C (rounded to 3 decimal places).

    Raises:
        ValueError: If baseline contains insufficient valid observations.
    """
    start_yr = baseline_config.baseline_start_year
    end_yr = baseline_config.baseline_end_year
    pct = baseline_config.percentile_threshold

    # 1. Index valid baseline temperatures by (month, day)
    baseline_pool_by_day: dict[tuple[int, int], list[float]] = defaultdict(list)
    total_valid_baseline_count = 0

    for obs in baseline_observations:
        if start_yr <= obs.date.year <= end_yr and obs.temp_max is not None:
            baseline_pool_by_day[(obs.date.month, obs.date.day)].append(obs.temp_max)
            total_valid_baseline_count += 1

    if total_valid_baseline_count < min_samples_threshold:
        raise ValueError(
            f"Insufficient baseline samples: total valid observations "
            f"({total_valid_baseline_count}) below minimum threshold "
            f"({min_samples_threshold}) across baseline period {start_yr}-{end_yr}."
        )

    # 2. Iterate all 366 potential calendar days in reference leap year 2000
    threshold_lookup: dict[tuple[int, int], float] = {}
    curr_date = date(_REFERENCE_LEAP_YEAR, 1, 1)
    end_date = date(_REFERENCE_LEAP_YEAR, 12, 31)

    while curr_date <= end_date:
        cal_key = (curr_date.month, curr_date.day)

        # Build centered window days: ±window_radius_days with circular wraparound
        window_keys: list[tuple[int, int]] = []
        for offset in range(-window_radius_days, window_radius_days + 1):
            offset_date = curr_date + timedelta(days=offset)
            window_keys.append((offset_date.month, offset_date.day))

        # Gather all observations across window keys
        sample_values: list[float] = []
        for w_key in window_keys:
            sample_values.extend(baseline_pool_by_day.get(w_key, []))

        if len(sample_values) < min_samples_threshold:
            raise ValueError(
                f"Insufficient baseline samples for calendar day "
                f"{cal_key[0]:02d}-{cal_key[1]:02d}: found {len(sample_values)} "
                f"observations in window (minimum required: {min_samples_threshold})."
            )

        # Compute percentile
        val = float(np.percentile(sample_values, pct, method="linear"))
        threshold_lookup[cal_key] = round(val, 3)

        curr_date += timedelta(days=1)

    return threshold_lookup
