"""Pure functions for detecting consecutive-day heatwave hazard events."""

from datetime import date
from typing import Final

from app.domain.models import DailyWeatherObservation, HeatwaveEvent

_DEFAULT_MIN_CONSECUTIVE_DAYS: Final[int] = 3


def detect_heatwave_events(
    observations: list[DailyWeatherObservation],
    threshold_lookup: dict[tuple[int, int], float],
    min_consecutive_days: int = _DEFAULT_MIN_CONSECUTIVE_DAYS,
) -> list[HeatwaveEvent]:
    """Detect discrete heatwave events using strict consecutive-day threshold exceedance.

    Core rules:
    - Sorts and validates timeseries chronologically.
    - Strict inequality: a day qualifies if and only if temp_max > threshold.
      (temp_max == threshold is non-qualifying).
    - Continuity: at least min_consecutive_days (default 3) consecutive calendar days required.
    - Missing measurements or calendar date gaps (>1 day) break streak continuity immediately.
    - Missing values are never filled or interpolated.
    - Multi-year events (e.g. Dec 30 -> Jan 2) are preserved as a single discrete event
      and assigned to their inception year.

    Args:
        observations: Daily weather observations.
        threshold_lookup: Precomputed (month, day) -> threshold_celsius mapping.
        min_consecutive_days: Minimum consecutive qualifying days (>= 1).

    Returns:
        List of detected HeatwaveEvent domain entities.
    """
    if min_consecutive_days < 1:
        raise ValueError(f"min_consecutive_days must be >= 1, got {min_consecutive_days}")

    if not observations:
        return []

    # 1. Sort observations chronologically and validate date uniqueness
    sorted_obs = sorted(observations, key=lambda x: x.date)

    seen_dates: set[date] = set()
    for obs in sorted_obs:
        if obs.date in seen_dates:
            raise ValueError(f"Duplicate observation date detected: {obs.date}")
        seen_dates.add(obs.date)

    # 2. Iterate and track consecutive streaks
    events: list[HeatwaveEvent] = []
    current_streak: list[tuple[DailyWeatherObservation, float]] = []
    prev_date: date | None = None

    def close_current_streak() -> None:
        nonlocal current_streak
        if len(current_streak) >= min_consecutive_days:
            streak_len = len(current_streak)
            start_d = current_streak[0][0].date
            end_d = current_streak[-1][0].date
            peak_temp = max(obs.temp_max for obs, _ in current_streak if obs.temp_max is not None)

            exceedances = [
                obs.temp_max - thresh for obs, thresh in current_streak if obs.temp_max is not None
            ]
            peak_exc = max(exceedances)
            cum_exc = sum(exceedances)
            mean_exc = cum_exc / streak_len
            mean_thresh = sum(thresh for _, thresh in current_streak) / streak_len

            daily_exc_tuple = tuple(
                (obs.date, round(obs.temp_max - thresh, 2))
                for obs, thresh in current_streak
                if obs.temp_max is not None
            )

            events.append(
                HeatwaveEvent(
                    start_date=start_d,
                    end_date=end_d,
                    duration_days=streak_len,
                    threshold_celsius=round(mean_thresh, 2),
                    peak_temperature=round(peak_temp, 2),
                    peak_exceedance=round(peak_exc, 2),
                    cumulative_exceedance=round(cum_exc, 2),
                    mean_exceedance=round(mean_exc, 2),
                    daily_exceedances=daily_exc_tuple,
                )
            )
        current_streak = []

    for obs in sorted_obs:
        # Check calendar date continuity
        if prev_date is not None and (obs.date - prev_date).days != 1:
            # Calendar gap breaks streak
            close_current_streak()

        prev_date = obs.date

        # Missing observation breaks streak
        if obs.temp_max is None:
            close_current_streak()
            continue

        cal_key = (obs.date.month, obs.date.day)
        threshold = threshold_lookup.get(cal_key)
        if threshold is None:
            close_current_streak()
            continue

        # Strict greater-than check
        if obs.temp_max > threshold:
            current_streak.append((obs, threshold))
        else:
            close_current_streak()

    # Close any ongoing streak at the end of the timeseries
    close_current_streak()

    return events
