"""Deterministic unit tests for the pure climate-analysis engine."""

from datetime import date, timedelta

import pytest

from app.domain.annual_metrics import aggregate_annual_metrics
from app.domain.detector import detect_heatwave_events
from app.domain.engine import run_climate_hazard_analysis
from app.domain.models import BaselineConfig, DailyWeatherObservation, GeoLocation
from app.domain.thresholds import calculate_calendar_day_thresholds
from app.domain.trends import (
    calculate_metric_trend,
    compute_all_hazard_trends,
    generate_trend_insights,
)


@pytest.fixture
def uniform_threshold_lookup() -> dict[tuple[int, int], float]:
    """Provide a constant 30.0°C threshold for all calendar days."""
    lookup: dict[tuple[int, int], float] = {}
    curr = date(2000, 1, 1)
    end = date(2000, 12, 31)
    while curr <= end:
        lookup[(curr.month, curr.day)] = 30.0
        curr += timedelta(days=1)
    return lookup


# ---------------- 1. Detection Rule Tests ----------------


def test_detection_zero_hot_days(uniform_threshold_lookup: dict[tuple[int, int], float]):
    """All temperatures below threshold must result in zero detected events."""
    obs = [
        DailyWeatherObservation(date=date(2020, 7, 1), temp_max=25.0),
        DailyWeatherObservation(date=date(2020, 7, 2), temp_max=26.0),
        DailyWeatherObservation(date=date(2020, 7, 3), temp_max=28.0),
        DailyWeatherObservation(date=date(2020, 7, 4), temp_max=29.0),
    ]
    events = detect_heatwave_events(obs, uniform_threshold_lookup)
    assert len(events) == 0


def test_detection_one_and_two_hot_days(uniform_threshold_lookup: dict[tuple[int, int], float]):
    """One or two hot days alone must NOT trigger a heatwave."""
    # Exactly one hot day
    obs_one = [
        DailyWeatherObservation(date=date(2020, 7, 1), temp_max=28.0),
        DailyWeatherObservation(date=date(2020, 7, 2), temp_max=35.0),  # hot
        DailyWeatherObservation(date=date(2020, 7, 3), temp_max=28.0),
    ]
    assert len(detect_heatwave_events(obs_one, uniform_threshold_lookup)) == 0

    # Exactly two hot days
    obs_two = [
        DailyWeatherObservation(date=date(2020, 7, 1), temp_max=28.0),
        DailyWeatherObservation(date=date(2020, 7, 2), temp_max=35.0),  # hot
        DailyWeatherObservation(date=date(2020, 7, 3), temp_max=36.0),  # hot
        DailyWeatherObservation(date=date(2020, 7, 4), temp_max=28.0),
    ]
    assert len(detect_heatwave_events(obs_two, uniform_threshold_lookup)) == 0


def test_detection_exactly_three_qualifying_days(
    uniform_threshold_lookup: dict[tuple[int, int], float],
):
    """Exactly three consecutive qualifying days must trigger one heatwave."""
    obs = [
        DailyWeatherObservation(date=date(2020, 7, 1), temp_max=28.0),
        DailyWeatherObservation(date=date(2020, 7, 2), temp_max=32.0),  # day 1
        DailyWeatherObservation(date=date(2020, 7, 3), temp_max=34.0),  # day 2
        DailyWeatherObservation(date=date(2020, 7, 4), temp_max=33.0),  # day 3
        DailyWeatherObservation(date=date(2020, 7, 5), temp_max=29.0),  # cool
    ]
    events = detect_heatwave_events(obs, uniform_threshold_lookup)
    assert len(events) == 1
    ev = events[0]
    assert ev.duration_days == 3
    assert ev.start_date == date(2020, 7, 2)
    assert ev.end_date == date(2020, 7, 4)
    assert ev.peak_temperature == 34.0
    # Threshold is 30.0: exceedances are 2.0, 4.0, 3.0 -> sum = 9.0
    assert ev.peak_exceedance == 4.0
    assert ev.cumulative_exceedance == 9.0
    assert ev.mean_exceedance == 3.0


def test_detection_longer_than_three_days(uniform_threshold_lookup: dict[tuple[int, int], float]):
    """An event spanning 5 days must be recorded as a single event of duration 5."""
    obs = [DailyWeatherObservation(date=date(2020, 7, i), temp_max=31.0 + i) for i in range(1, 6)]
    events = detect_heatwave_events(obs, uniform_threshold_lookup)
    assert len(events) == 1
    assert events[0].duration_days == 5
    assert events[0].start_date == date(2020, 7, 1)
    assert events[0].end_date == date(2020, 7, 5)


def test_detection_temperature_equal_to_threshold(
    uniform_threshold_lookup: dict[tuple[int, int], float],
):
    """Temperature strictly equal to threshold must NOT qualify (strict inequality rule)."""
    # Threshold is exactly 30.0; temperature is 30.0 for 5 consecutive days
    obs = [DailyWeatherObservation(date=date(2020, 7, i), temp_max=30.0) for i in range(1, 6)]
    events = detect_heatwave_events(obs, uniform_threshold_lookup)
    assert len(events) == 0


def test_detection_missing_measurement_breaks_streak(
    uniform_threshold_lookup: dict[tuple[int, int], float],
):
    """A missing observation (None) must break continuity and prevent qualification."""
    obs = [
        DailyWeatherObservation(date=date(2020, 7, 1), temp_max=35.0),  # hot
        DailyWeatherObservation(date=date(2020, 7, 2), temp_max=35.0),  # hot
        DailyWeatherObservation(date=date(2020, 7, 3), temp_max=None),  # missing!
        DailyWeatherObservation(date=date(2020, 7, 4), temp_max=35.0),  # hot
        DailyWeatherObservation(date=date(2020, 7, 5), temp_max=35.0),  # hot
    ]
    events = detect_heatwave_events(obs, uniform_threshold_lookup)
    # Neither pre-gap nor post-gap streak reaches 3 consecutive days
    assert len(events) == 0


def test_detection_calendar_gap_breaks_streak(
    uniform_threshold_lookup: dict[tuple[int, int], float],
):
    """A missing calendar date (>1 day gap) must break streak continuity."""
    obs = [
        DailyWeatherObservation(date=date(2020, 7, 1), temp_max=35.0),
        DailyWeatherObservation(date=date(2020, 7, 2), temp_max=35.0),
        # July 3 omitted entirely from timeseries
        DailyWeatherObservation(date=date(2020, 7, 4), temp_max=35.0),
        DailyWeatherObservation(date=date(2020, 7, 5), temp_max=35.0),
    ]
    events = detect_heatwave_events(obs, uniform_threshold_lookup)
    assert len(events) == 0


def test_detection_interrupted_by_cool_day(uniform_threshold_lookup: dict[tuple[int, int], float]):
    """Cool day terminating streak prevents reaching 3 days."""
    obs = [
        DailyWeatherObservation(date=date(2020, 7, 1), temp_max=35.0),
        DailyWeatherObservation(date=date(2020, 7, 2), temp_max=35.0),
        DailyWeatherObservation(date=date(2020, 7, 3), temp_max=22.0),  # cool day
        DailyWeatherObservation(date=date(2020, 7, 4), temp_max=35.0),
        DailyWeatherObservation(date=date(2020, 7, 5), temp_max=35.0),
    ]
    events = detect_heatwave_events(obs, uniform_threshold_lookup)
    assert len(events) == 0


def test_detection_year_boundary_crossing(uniform_threshold_lookup: dict[tuple[int, int], float]):
    """Events crossing Dec 31 -> Jan 1 must be unified and attributed to the inception year."""
    obs = [
        DailyWeatherObservation(date=date(2020, 12, 30), temp_max=35.0),
        DailyWeatherObservation(date=date(2020, 12, 31), temp_max=36.0),
        DailyWeatherObservation(date=date(2021, 1, 1), temp_max=34.0),
        DailyWeatherObservation(date=date(2021, 1, 2), temp_max=32.0),
        DailyWeatherObservation(date=date(2021, 1, 3), temp_max=25.0),  # ends
    ]
    events = detect_heatwave_events(obs, uniform_threshold_lookup)
    assert len(events) == 1
    ev = events[0]
    assert ev.duration_days == 4
    assert ev.start_date == date(2020, 12, 30)
    assert ev.end_date == date(2021, 1, 2)

    # Attribution to inception year
    annual = aggregate_annual_metrics(
        events=events,
        observations=obs,
        start_year=2020,
        end_year=2021,
    )
    assert annual[0].year == 2020
    assert annual[0].event_count == 1
    assert annual[1].year == 2021
    assert annual[1].event_count == 0  # not duplicated in 2021!


# ---------------- 2. Threshold & Baseline Tests ----------------


def test_thresholds_moving_window_and_leap_day():
    """Verify ±7 days centered window calculation and Feb 29 handling."""
    # Generate 5 baseline years with a synthetic seasonal cycle
    baseline_obs: list[DailyWeatherObservation] = []
    base_config = BaselineConfig(baseline_start_year=1991, baseline_end_year=1995)

    for yr in range(1991, 1996):
        curr = date(yr, 1, 1)
        end = date(yr, 12, 31)
        while curr <= end:
            # Summer days hotter than winter days
            base_temp = 30.0 if (curr.month in {6, 7, 8}) else 10.0
            baseline_obs.append(DailyWeatherObservation(date=curr, temp_max=base_temp))
            curr += timedelta(days=1)

    thresholds = calculate_calendar_day_thresholds(
        baseline_observations=baseline_obs,
        baseline_config=base_config,
        window_radius_days=7,
        min_samples_threshold=15,
    )

    # Must contain all 366 days
    assert len(thresholds) == 366
    assert (2, 29) in thresholds
    assert thresholds[(7, 15)] > thresholds[(1, 15)]


def test_insufficient_baseline_samples_raises_error():
    """Verify that insufficient baseline records trigger a descriptive ValueError."""
    config = BaselineConfig(baseline_start_year=1991, baseline_end_year=2020)
    # Only 3 observations provided
    obs = [
        DailyWeatherObservation(date=date(1991, 1, 1), temp_max=20.0),
        DailyWeatherObservation(date=date(1991, 1, 2), temp_max=21.0),
        DailyWeatherObservation(date=date(1991, 1, 3), temp_max=22.0),
    ]

    with pytest.raises(ValueError, match="Insufficient baseline samples"):
        calculate_calendar_day_thresholds(obs, config, min_samples_threshold=15)


# ---------------- 3. Annual Metrics & Quality Tests ----------------


def test_annual_metrics_incomplete_coverage():
    """Verify that a year with low completeness is marked as incomplete."""
    # Year 2020 has only 100 observations (out of 366 expected)
    obs = [
        DailyWeatherObservation(date=date(2020, 1, 1) + timedelta(days=i), temp_max=20.0)
        for i in range(100)
    ]
    annual = aggregate_annual_metrics(
        events=[],
        observations=obs,
        start_year=2020,
        end_year=2020,
    )
    assert len(annual) == 1
    metric = annual[0]
    assert metric.completeness_percentage < 50.0
    assert metric.quality_status == "insufficient_data"


# ---------------- 4. Trend Analysis Tests ----------------


def test_trends_flat_rising_falling():
    """Test linear trend calculations on flat, rising, and falling timeseries."""
    years = list(range(2000, 2020))  # 20 years

    # Rising trend
    rising_vals = [float(i) for i in range(20)]
    rising_trend = calculate_metric_trend(
        years=years, values=rising_vals, metric_name="test_rising", unit="units"
    )
    assert rising_trend.slope is not None
    assert rising_trend.slope > 0
    assert rising_trend.direction == "increasing"
    assert rising_trend.is_significant is True

    # Falling trend
    falling_vals = [float(20 - i) for i in range(20)]
    falling_trend = calculate_metric_trend(
        years=years, values=falling_vals, metric_name="test_falling", unit="units"
    )
    assert falling_trend.slope is not None
    assert falling_trend.slope < 0
    assert falling_trend.direction == "decreasing"
    assert falling_trend.is_significant is True

    # Flat / constant trend
    flat_vals = [5.0] * 20
    flat_trend = calculate_metric_trend(
        years=years, values=flat_vals, metric_name="test_flat", unit="units"
    )
    assert flat_trend.slope == 0.0
    assert flat_trend.direction == "stable"
    assert flat_trend.p_value == 1.0


def test_zero_baseline_percentage_changes():
    """Verify insight generator suppresses percentage change when baseline mean is 0.0."""
    years = list(range(2000, 2020))  # 20 years
    # First 10 years: 0 events; last 10 years: 2 events
    annual_metrics = [
        aggregate_annual_metrics(
            events=[],
            observations=[DailyWeatherObservation(date=date(y, 1, 1), temp_max=20.0)],
            start_year=y,
            end_year=y,
        )[0]
        for y in years
    ]

    # Override event counts
    metrics = []
    for i, m in enumerate(annual_metrics):
        cnt = 0 if i < 10 else 2
        metrics.append(
            m.__class__(
                year=m.year,
                event_count=cnt,
                total_heatwave_days=cnt * 3,
                max_duration_days=3 if cnt > 0 else None,
                mean_duration_days=3.0 if cnt > 0 else None,
                cumulative_intensity=6.0 if cnt > 0 else None,
                peak_intensity=2.0 if cnt > 0 else None,
                mean_peak_temperature=32.0 if cnt > 0 else None,
                expected_days=365,
                usable_days=365,
                completeness_percentage=100.0,
                quality_status="reliable",
            )
        )

    trends = compute_all_hazard_trends(metrics)
    insights = generate_trend_insights(metrics, trends)

    # Check for mathematically sound handling of zero baseline
    zero_baseline_mention = any(
        "Percentage change is mathematically undefined due to a zero baseline" in ins
        for ins in insights
    )
    assert zero_baseline_mention is True


def test_complete_engine_pipeline():
    """Verify end-to-end execution of the pure run_climate_hazard_analysis pipeline."""
    location = GeoLocation(latitude=52.52, longitude=13.41, name="Berlin")
    baseline_cfg = BaselineConfig(baseline_start_year=2000, baseline_end_year=2004)

    # Generate synthetic observations for 2000-2005
    observations: list[DailyWeatherObservation] = []
    for yr in range(2000, 2006):
        curr = date(yr, 1, 1)
        end = date(yr, 12, 31)
        while curr <= end:
            # Baseline days at 20°C; In 2005 introduce an intentional 4-day heatwave in July
            temp = 20.0
            if yr == 2005 and curr.month == 7 and 10 <= curr.day <= 13:
                temp = 35.0  # qualifying 4-day heatwave

            observations.append(DailyWeatherObservation(date=curr, temp_max=temp))
            curr += timedelta(days=1)

    result = run_climate_hazard_analysis(
        location=location,
        observations=observations,
        baseline_config=baseline_cfg,
        analysis_start_year=2000,
        analysis_end_year=2005,
    )

    assert result.location.name == "Berlin"
    assert len(result.events) == 1
    assert result.events[0].duration_days == 4
    assert result.events[0].start_date == date(2005, 7, 10)
    assert len(result.annual_metrics) == 6
    assert result.annual_metrics[-1].event_count == 1
    assert len(result.insights) > 0


def test_boundary_events_crossing_start_of_analysis_window():
    """Verify that an event starting prior to the analysis window with days extending into it is detected and attributed."""
    location = GeoLocation(latitude=40.0, longitude=-75.0, name="BoundaryStartTest")
    baseline_cfg = BaselineConfig(baseline_start_year=2000, baseline_end_year=2004)

    # Observations from 2000-01-01 to 2007-12-31, baseline at 20°C
    observations: list[DailyWeatherObservation] = []
    for yr in range(2000, 2008):
        curr = date(yr, 1, 1)
        end = date(yr, 12, 31)
        while curr <= end:
            temp = 20.0
            # Event crosses start boundary: 2004-12-29 to 2005-01-03 (6 days: 3 in 2004, 3 in 2005)
            if (curr >= date(2004, 12, 29)) and (curr <= date(2005, 1, 3)):
                temp = 35.0
            observations.append(DailyWeatherObservation(date=curr, temp_max=temp))
            curr += timedelta(days=1)

    result = run_climate_hazard_analysis(
        location=location,
        observations=observations,
        baseline_config=baseline_cfg,
        analysis_start_year=2005,
        analysis_end_year=2007,
    )

    # 1. Event must be captured in scoped_events
    assert len(result.events) == 1
    event = result.events[0]
    assert event.start_date == date(2004, 12, 29)
    assert event.end_date == date(2005, 1, 3)
    assert event.duration_days == 6

    # 2. Rule: Event count belongs to inception year (2004), so 2005 event_count is 0
    m_2005 = next(m for m in result.annual_metrics if m.year == 2005)
    assert m_2005.event_count == 0
    assert m_2005.mean_duration_days is None
    assert m_2005.max_duration_days is None

    # 3. Rule: Heatwave days belong to the actual calendar year: 3 days in 2005
    assert m_2005.total_heatwave_days == 3
    assert m_2005.cumulative_intensity is not None
    assert m_2005.cumulative_intensity > 0


def test_boundary_events_crossing_end_of_analysis_window():
    """Verify that an event starting at the end of the analysis window and extending past it is not truncated."""
    location = GeoLocation(latitude=40.0, longitude=-75.0, name="BoundaryEndTest")
    baseline_cfg = BaselineConfig(baseline_start_year=2000, baseline_end_year=2004)

    # Observations from 2000-01-01 to 2008-01-15 (including boundary buffer after 2007-12-31)
    observations: list[DailyWeatherObservation] = []
    for yr in range(2000, 2008):
        curr = date(yr, 1, 1)
        end = date(yr, 12, 31)
        while curr <= end:
            temp = 20.0
            # Event crosses end boundary: 2007-12-30 to 2008-01-04 (6 days: 2 in 2007, 4 in 2008)
            if curr >= date(2007, 12, 30):
                temp = 36.0
            observations.append(DailyWeatherObservation(date=curr, temp_max=temp))
            curr += timedelta(days=1)

    # Add January 2008 boundary buffer days
    for d in range(1, 15):
        temp = 36.0 if d <= 4 else 20.0
        observations.append(DailyWeatherObservation(date=date(2008, 1, d), temp_max=temp))

    result = run_climate_hazard_analysis(
        location=location,
        observations=observations,
        baseline_config=baseline_cfg,
        analysis_start_year=2005,
        analysis_end_year=2007,
    )

    # 1. Event must be fully detected without truncation
    assert len(result.events) == 1
    event = result.events[0]
    assert event.start_date == date(2007, 12, 30)
    assert event.end_date == date(2008, 1, 4)
    assert event.duration_days == 6

    # 2. Rule: Event count belongs to inception year (2007)
    m_2007 = next(m for m in result.annual_metrics if m.year == 2007)
    assert m_2007.event_count == 1
    assert m_2007.mean_duration_days == 6.0
    assert m_2007.max_duration_days == 6

    # 3. Rule: Heatwave days belong to the calendar year: only 2 days in 2007 (Dec 30 & 31)
    assert m_2007.total_heatwave_days == 2


def test_boundary_events_dual_crossings_regression():
    """Verify concurrent handling of boundary crossings at both start and end of the analysis window."""
    location = GeoLocation(latitude=40.0, longitude=-75.0, name="DualBoundaryTest")
    baseline_cfg = BaselineConfig(baseline_start_year=2000, baseline_end_year=2004)

    observations: list[DailyWeatherObservation] = []
    for yr in range(2000, 2008):
        curr = date(yr, 1, 1)
        end = date(yr, 12, 31)
        while curr <= end:
            temp = 20.0
            # Event 1: crosses start window (2004-12-30 to 2005-01-03 = 5 days: 2 in 2004, 3 in 2005)
            if date(2004, 12, 30) <= curr <= date(2005, 1, 3):
                temp = 34.0
            # Event 2: crosses end window (2007-12-30 to 2008-01-02 = 4 days: 2 in 2007, 2 in 2008)
            elif curr >= date(2007, 12, 30):
                temp = 35.0
            observations.append(DailyWeatherObservation(date=curr, temp_max=temp))
            curr += timedelta(days=1)

    # Boundary buffer for Jan 2008
    for d in range(1, 10):
        temp = 35.0 if d <= 2 else 20.0
        observations.append(DailyWeatherObservation(date=date(2008, 1, d), temp_max=temp))

    result = run_climate_hazard_analysis(
        location=location,
        observations=observations,
        baseline_config=baseline_cfg,
        analysis_start_year=2005,
        analysis_end_year=2007,
    )

    assert len(result.events) == 2
    m_2005 = next(m for m in result.annual_metrics if m.year == 2005)
    m_2006 = next(m for m in result.annual_metrics if m.year == 2006)
    m_2007 = next(m for m in result.annual_metrics if m.year == 2007)

    # 2005: 0 events started, 3 days from prior-year carryover
    assert m_2005.event_count == 0
    assert m_2005.total_heatwave_days == 3

    # 2006: 0 events, 0 days
    assert m_2006.event_count == 0
    assert m_2006.total_heatwave_days == 0

    # 2007: 1 event started, 2 days in 2007
    assert m_2007.event_count == 1
    assert m_2007.total_heatwave_days == 2
    assert m_2007.max_duration_days == 4

