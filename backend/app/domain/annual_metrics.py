"""Pure functions for computing annual hazard metrics and data completeness."""

import calendar
from collections import defaultdict
from typing import Final

from app.domain.models import AnnualHeatwaveMetrics, DailyWeatherObservation, HeatwaveEvent

_DEFAULT_COMPLETENESS_THRESHOLD_PCT: Final[float] = 90.0
_DEFAULT_MAX_MISSING_STREAK: Final[int] = 15


def aggregate_annual_metrics(
    events: list[HeatwaveEvent],
    observations: list[DailyWeatherObservation],
    start_year: int,
    end_year: int,
    completeness_threshold_pct: float = _DEFAULT_COMPLETENESS_THRESHOLD_PCT,
    max_missing_streak_threshold: int = _DEFAULT_MAX_MISSING_STREAK,
) -> list[AnnualHeatwaveMetrics]:
    """Aggregate discrete heatwave events into annual metrics with data quality evaluation.

    Distinctly separates genuine zeros from unavailable metrics:
    - If event_count == 0: duration, intensity, and peak temperatures are None.
    - If completeness < 90% or missing streak > 15 days: flagged as 'incomplete' or
      'insufficient_data', indicating that a zero count may be unreliable.

    Args:
        events: Detected heatwave events.
        observations: Normalized daily observations.
        start_year: Starting analysis year.
        end_year: Ending analysis year.
        completeness_threshold_pct: Minimum completeness percentage for 'reliable' status.
        max_missing_streak_threshold: Maximum tolerated missing streak in days.

    Returns:
        Chronological list of AnnualHeatwaveMetrics records.
    """
    if start_year > end_year:
        raise ValueError(f"start_year ({start_year}) cannot exceed end_year ({end_year})")

    # Index observations by year
    obs_by_year: dict[int, list[DailyWeatherObservation]] = defaultdict(list)
    for obs in observations:
        obs_by_year[obs.date.year].append(obs)

    # Index events by inception year
    events_by_year: dict[int, list[HeatwaveEvent]] = defaultdict(list)
    for ev in events:
        events_by_year[ev.start_date.year].append(ev)

    annual_results: list[AnnualHeatwaveMetrics] = []

    for yr in range(start_year, end_year + 1):
        expected_days = 366 if calendar.isleap(yr) else 365
        yr_obs = sorted(obs_by_year.get(yr, []), key=lambda x: x.date)

        usable_days = sum(1 for o in yr_obs if o.temp_max is not None)
        completeness_pct = (
            round((usable_days / expected_days) * 100.0, 2) if expected_days > 0 else 0.0
        )

        # Compute longest missing streak in this calendar year
        longest_missing = 0
        current_missing = 0
        for o in yr_obs:
            if o.temp_max is None:
                current_missing += 1
                if current_missing > longest_missing:
                    longest_missing = current_missing
            else:
                current_missing = 0

        # Assess annual quality status
        if (
            completeness_pct >= completeness_threshold_pct
            and longest_missing <= max_missing_streak_threshold
        ):
            quality_status = "reliable"
        elif completeness_pct < 50.0:
            quality_status = "insufficient_data"
        else:
            quality_status = "incomplete"

        yr_events = events_by_year.get(yr, [])
        event_cnt = len(yr_events)

        if event_cnt == 0:
            metric = AnnualHeatwaveMetrics(
                year=yr,
                event_count=0,
                total_heatwave_days=0,
                max_duration_days=None,
                mean_duration_days=None,
                cumulative_intensity=None,
                peak_intensity=None,
                mean_peak_temperature=None,
                expected_days=expected_days,
                usable_days=usable_days,
                completeness_percentage=completeness_pct,
                quality_status=quality_status,
            )
        else:
            total_hw_days = sum(e.duration_days for e in yr_events)
            max_dur = max(e.duration_days for e in yr_events)
            mean_dur = round(total_hw_days / event_cnt, 2)
            cum_intensity = round(sum(e.cumulative_exceedance for e in yr_events), 2)
            peak_intensity = round(max(e.peak_exceedance for e in yr_events), 2)
            mean_peak_temp = round(sum(e.peak_temperature for e in yr_events) / event_cnt, 2)

            metric = AnnualHeatwaveMetrics(
                year=yr,
                event_count=event_cnt,
                total_heatwave_days=total_hw_days,
                max_duration_days=max_dur,
                mean_duration_days=mean_dur,
                cumulative_intensity=cum_intensity,
                peak_intensity=peak_intensity,
                mean_peak_temperature=mean_peak_temp,
                expected_days=expected_days,
                usable_days=usable_days,
                completeness_percentage=completeness_pct,
                quality_status=quality_status,
            )

        annual_results.append(metric)

    return annual_results
