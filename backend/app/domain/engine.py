"""Pure climate analysis orchestrator.

Assembles threshold calculation, consecutive-day hazard detection,
annual metrics aggregation, and statistical trend estimation into a
unified domain workflow without external I/O dependencies.
"""

from app.domain.annual_metrics import aggregate_annual_metrics
from app.domain.detector import detect_heatwave_events
from app.domain.models import (
    BaselineConfig,
    CompleteAnalysisResult,
    DailyWeatherObservation,
    DataQualityStats,
    GeoLocation,
)
from app.domain.thresholds import calculate_calendar_day_thresholds
from app.domain.trends import compute_all_hazard_trends, generate_trend_insights


def run_climate_hazard_analysis(
    location: GeoLocation,
    observations: list[DailyWeatherObservation],
    baseline_config: BaselineConfig,
    analysis_start_year: int,
    analysis_end_year: int,
    quality_stats: DataQualityStats | None = None,
    min_consecutive_days: int = 3,
) -> CompleteAnalysisResult:
    """Execute complete climate hazard analysis pipeline.

    Purity guarantee:
    - Pure computation only. No network, filesystem, or database calls.
    - Deterministic across all input configurations.

    Args:
        location: Geographic coordinates and metadata.
        observations: Full timeseries of daily observations including baseline.
        baseline_config: Baseline window and percentile definition.
        analysis_start_year: User-requested analysis start year.
        analysis_end_year: User-requested analysis end year.
        quality_stats: Precalculated or synthetic data quality diagnostics.
        min_consecutive_days: Threshold duration in days (default 3).

    Returns:
        CompleteAnalysisResult with thresholds, events, metrics, trends, and insights.
    """
    # 1. Compute moving-window thresholds exclusively from the baseline period
    threshold_lookup = calculate_calendar_day_thresholds(
        baseline_observations=observations,
        baseline_config=baseline_config,
    )

    # 2. Detect discrete heatwave events across observations
    events = detect_heatwave_events(
        observations=observations,
        threshold_lookup=threshold_lookup,
        min_consecutive_days=min_consecutive_days,
    )

    # 3. Filter events to the requested analysis window
    scoped_events = [
        ev for ev in events if analysis_start_year <= ev.start_date.year <= analysis_end_year
    ]

    # 4. Filter observations for the analysis span to calculate annual metrics
    scoped_obs = [
        obs for obs in observations if analysis_start_year <= obs.date.year <= analysis_end_year
    ]

    annual_metrics = aggregate_annual_metrics(
        events=scoped_events,
        observations=scoped_obs,
        start_year=analysis_start_year,
        end_year=analysis_end_year,
    )

    # 5. Compute statistical trends
    trends = compute_all_hazard_trends(annual_metrics)

    # 6. Generate human-readable analytical insights
    insights = generate_trend_insights(annual_metrics, trends)

    # Derive overall quality stats if not provided
    if quality_stats is None:
        total_days = len(scoped_obs)
        observed_days = sum(1 for o in scoped_obs if o.temp_max is not None)
        missing_days = total_days - observed_days
        comp_ratio = observed_days / total_days if total_days > 0 else 0.0
        quality_stats = DataQualityStats(
            total_expected_days=total_days,
            observed_days=observed_days,
            missing_days=missing_days,
            completeness_ratio=round(comp_ratio, 4),
            has_critical_gaps=(comp_ratio < 0.90),
        )

    # Average baseline threshold for reference metadata
    avg_thresh = round(sum(threshold_lookup.values()) / len(threshold_lookup), 2)
    resolved_baseline = BaselineConfig(
        baseline_start_year=baseline_config.baseline_start_year,
        baseline_end_year=baseline_config.baseline_end_year,
        percentile_threshold=baseline_config.percentile_threshold,
        min_consecutive_days=min_consecutive_days,
        source_model=baseline_config.source_model,
        calculated_threshold_celsius=avg_thresh,
    )

    return CompleteAnalysisResult(
        location=location,
        baseline=resolved_baseline,
        data_quality=quality_stats,
        events=scoped_events,
        annual_metrics=annual_metrics,
        trends=trends,
        insights=insights,
    )
