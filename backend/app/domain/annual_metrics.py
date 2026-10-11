"""Pure functions for computing annual hazard metrics and data completeness."""

import calendar
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
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
    current_year: int | None = None,
) -> list[AnnualHeatwaveMetrics]:
    """Aggregate discrete heatwave events into annual metrics with data quality evaluation.

    Cross-Year Accounting & Attribution:
    - Retains event-count attribution to the year an event begins.
    - Calculates heatwave days per calendar year (cross-year events distribute days to
      the year in which each day occurs).
    - Attributes daily exceedance intensity to the exact calendar year of each qualifying day.
    - Accurately tracks calendar date gaps in missing streak calculations.
    - Current calendar year is flagged as 'provisional' (year-to-date).

    Args:
        events: Detected heatwave events.
        observations: Normalized daily observations.
        start_year: Starting analysis year.
        end_year: Ending analysis year.
        completeness_threshold_pct: Minimum completeness percentage for 'reliable' status.
        max_missing_streak_threshold: Maximum tolerated missing streak in days.
        current_year: Reference current year for provisional status (defaults to current UTC year).

    Returns:
        Chronological list of AnnualHeatwaveMetrics records.
    """
    if start_year > end_year:
        raise ValueError(f"start_year ({start_year}) cannot exceed end_year ({end_year})")

    ref_current_year = current_year if current_year is not None else datetime.now(UTC).year

    # Index observations by date
    obs_by_date = {obs.date: obs for obs in observations}

    # 1. Event count attributed to inception year
    events_started_by_year: dict[int, list[HeatwaveEvent]] = defaultdict(list)
    for ev in events:
        events_started_by_year[ev.start_date.year].append(ev)

    # 2. Daily heatwave days and daily exceedance intensity per calendar year
    heatwave_days_by_year: dict[int, int] = defaultdict(int)
    intensity_by_year: dict[int, float] = defaultdict(float)

    for ev in events:
        if ev.daily_exceedances:
            for d, exc in ev.daily_exceedances:
                heatwave_days_by_year[d.year] += 1
                intensity_by_year[d.year] += exc
        else:
            curr = ev.start_date
            daily_avg_exc = (
                ev.cumulative_exceedance / ev.duration_days if ev.duration_days > 0 else 0.0
            )
            while curr <= ev.end_date:
                heatwave_days_by_year[curr.year] += 1
                intensity_by_year[curr.year] += daily_avg_exc
                curr += timedelta(days=1)

    annual_results: list[AnnualHeatwaveMetrics] = []

    for yr in range(start_year, end_year + 1):
        expected_days = 366 if calendar.isleap(yr) else 365

        # Calendar completeness & true missing streak calculation
        usable_days = 0
        longest_missing = 0
        current_missing = 0

        cal_date = date(yr, 1, 1)
        cal_end = date(yr, 12, 31)

        while cal_date <= cal_end:
            obs = obs_by_date.get(cal_date)
            if obs is not None and obs.temp_max is not None:
                usable_days += 1
                current_missing = 0
            else:
                current_missing += 1
                if current_missing > longest_missing:
                    longest_missing = current_missing
            cal_date += timedelta(days=1)

        completeness_pct = (
            round((usable_days / expected_days) * 100.0, 2) if expected_days > 0 else 0.0
        )

        # Assess annual quality status
        if yr == ref_current_year:
            quality_status = "provisional"
        elif (
            completeness_pct >= completeness_threshold_pct
            and longest_missing <= max_missing_streak_threshold
        ):
            quality_status = "reliable"
        elif completeness_pct < 50.0:
            quality_status = "insufficient_data"
        else:
            quality_status = "incomplete"

        yr_events = events_started_by_year.get(yr, [])
        event_cnt = len(yr_events)
        total_hw_days = heatwave_days_by_year.get(yr, 0)
        cum_intensity = round(intensity_by_year[yr], 2) if total_hw_days > 0 else None

        if event_cnt == 0:
            metric = AnnualHeatwaveMetrics(
                year=yr,
                event_count=0,
                total_heatwave_days=total_hw_days,
                max_duration_days=None,
                mean_duration_days=None,
                cumulative_intensity=cum_intensity,
                peak_intensity=None,
                mean_peak_temperature=None,
                expected_days=expected_days,
                usable_days=usable_days,
                completeness_percentage=completeness_pct,
                quality_status=quality_status,
            )
        else:
            max_dur = max(e.duration_days for e in yr_events)
            mean_dur = round(sum(e.duration_days for e in yr_events) / event_cnt, 2)
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
