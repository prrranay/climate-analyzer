"""Pure functions for linear trend analysis, statistical significance, and insight generation."""

from typing import Final

import numpy as np
from scipy.stats import linregress

from app.domain.models import AnnualHeatwaveMetrics, TrendDirection, TrendStatistics

_DEFAULT_MIN_YEARS_FOR_TREND: Final[int] = 10
_DEFAULT_ALPHA_SIGNIFICANCE: Final[float] = 0.05


def calculate_metric_trend(
    years: list[int],
    values: list[float],
    metric_name: str,
    unit: str,
    min_years_required: int = _DEFAULT_MIN_YEARS_FOR_TREND,
    alpha: float = _DEFAULT_ALPHA_SIGNIFICANCE,
) -> TrendStatistics:
    """Calculate ordinary least-squares linear trend with hypothesis testing (p-value).

    Guarantees:
    - Never claims statistical significance simply because the slope is nonzero.
    - Tests null hypothesis H0: slope == 0 vs H1: slope != 0 at significance level
      alpha (default 0.05).
    - Requires at least min_years_required (default 10) data points.
    - Expresses rates of change in [unit/decade] and [unit/year].

    Args:
        years: Calendar years (x-axis).
        values: Annual metric values (y-axis).
        metric_name: Name of metric being evaluated.
        unit: Base unit of the metric (e.g. 'events', 'days', '°C-days').
        min_years_required: Minimum sample size threshold.
        alpha: Two-tailed significance threshold (default 0.05).

    Returns:
        TrendStatistics domain entity with slope, intercept, p-value, and direction.
    """
    n_years = len(years)

    if n_years < min_years_required:
        return TrendStatistics(
            metric_name=metric_name,
            slope=None,
            intercept=None,
            p_value=None,
            direction="indeterminate",
            is_significant=False,
            unit=f"{unit}/decade",
            sample_size_years=n_years,
            description=(
                f"Insufficient sample size: {n_years} years provided "
                f"(minimum required: {min_years_required} years)."
            ),
        )

    # Convert to NumPy arrays
    x = np.array(years, dtype=float)
    y = np.array(values, dtype=float)

    # Check for constant/flat values
    if np.all(np.isclose(y, y[0])):
        return TrendStatistics(
            metric_name=metric_name,
            slope=0.0,
            intercept=float(y[0]),
            p_value=1.0,
            direction="stable",
            is_significant=False,
            unit=f"{unit}/decade",
            sample_size_years=n_years,
            description=(
                f"Metric remained constant at {y[0]:.2f} {unit} across all {n_years} years."
            ),
        )

    # Calculate linear regression
    res = linregress(x, y)
    slope_annual = float(res.slope)
    slope_decadal = round(slope_annual * 10.0, 3)
    intercept = round(float(res.intercept), 3)
    p_val = round(float(res.pvalue), 4)

    is_significant = p_val < alpha

    direction: TrendDirection
    if is_significant:
        direction = "increasing" if slope_annual > 0 else "decreasing"
    else:
        # If not statistically distinguishable from zero
        direction = "stable" if abs(slope_decadal) < 0.05 else "indeterminate"

    sig_text = (
        f"statistically significant (p={p_val:.4f} < {alpha})"
        if is_significant
        else f"not statistically significant (p={p_val:.4f} >= {alpha})"
    )
    desc = (
        f"{direction.capitalize()} trend of {slope_decadal:+.3f} {unit}/decade ({sig_text}) "
        f"over {n_years} years."
    )

    return TrendStatistics(
        metric_name=metric_name,
        slope=slope_decadal,
        intercept=intercept,
        p_value=p_val,
        direction=direction,
        is_significant=is_significant,
        unit=f"{unit}/decade",
        sample_size_years=n_years,
        description=desc,
    )


def compute_all_hazard_trends(
    annual_metrics: list[AnnualHeatwaveMetrics],
    min_years: int = _DEFAULT_MIN_YEARS_FOR_TREND,
) -> dict[str, TrendStatistics]:
    """Compute trend statistics for frequency, duration, and intensity."""
    if not annual_metrics:
        return {}

    years = [m.year for m in annual_metrics]

    frequency_values = [float(m.event_count) for m in annual_metrics]
    hw_days_values = [float(m.total_heatwave_days) for m in annual_metrics]
    intensity_values = [
        float(m.cumulative_intensity) if m.cumulative_intensity is not None else 0.0
        for m in annual_metrics
    ]

    return {
        "annual_frequency": calculate_metric_trend(
            years=years,
            values=frequency_values,
            metric_name="annual_frequency",
            unit="events",
            min_years_required=min_years,
        ),
        "heatwave_days": calculate_metric_trend(
            years=years,
            values=hw_days_values,
            metric_name="heatwave_days",
            unit="days",
            min_years_required=min_years,
        ),
        "cumulative_intensity": calculate_metric_trend(
            years=years,
            values=intensity_values,
            metric_name="cumulative_intensity",
            unit="°C-days",
            min_years_required=min_years,
        ),
    }


def generate_trend_insights(
    annual_metrics: list[AnnualHeatwaveMetrics],
    trends: dict[str, TrendStatistics],
) -> list[str]:
    """Generate human-readable analytical observations.

    Strict scientific handling of:
    - Zero comparison baseline (percentages undefined, reports absolute differences).
    - Statistical significance qualification.
    - Data quality reliability warnings.
    """
    insights: list[str] = []

    if not annual_metrics:
        return ["No historical meteorological records were provided for hazard analysis."]

    total_years = len(annual_metrics)
    unreliable_years = [m.year for m in annual_metrics if m.quality_status != "reliable"]

    if unreliable_years:
        insights.append(
            f"Data quality notice: {len(unreliable_years)} of {total_years} years "
            f"({', '.join(str(y) for y in unreliable_years[:5])}"
            f"{'...' if len(unreliable_years) > 5 else ''}) "
            f"had incomplete coverage (<90%). Observations for those years should be treated "
            f"with caution."
        )

    # Frequency trend insight
    freq_trend = trends.get("annual_frequency")
    if freq_trend and freq_trend.slope is not None:
        if freq_trend.is_significant:
            insights.append(
                f"Statistically significant {freq_trend.direction} trend in annual heatwave "
                f"frequency: {freq_trend.slope:+.2f} events/decade (p={freq_trend.p_value:.4f})."
            )
        else:
            insights.append(
                f"Observed decadal slope in heatwave frequency ({freq_trend.slope:+.2f} "
                f"events/decade) is not statistically significant "
                f"(p={freq_trend.p_value:.4f} >= 0.05)."
            )

    # Comparison between early baseline and recent period
    if total_years >= 10:
        split = total_years // 2
        early_slice = annual_metrics[:split]
        recent_slice = annual_metrics[split:]

        early_mean_events = float(np.mean([m.event_count for m in early_slice]))
        recent_mean_events = float(np.mean([m.event_count for m in recent_slice]))
        diff_events = recent_mean_events - early_mean_events

        early_yrs_label = f"{early_slice[0].year}–{early_slice[-1].year}"
        recent_yrs_label = f"{recent_slice[0].year}–{recent_slice[-1].year}"

        if np.isclose(early_mean_events, 0.0):
            insights.append(
                f"Period comparison: Early period ({early_yrs_label}) averaged 0.00 events/year, "
                f"while recent period ({recent_yrs_label}) averaged {recent_mean_events:.2f} "
                f"events/year. Percentage change is mathematically undefined due to a zero "
                f"baseline; absolute shift is {diff_events:+.2f} events/year."
            )
        else:
            pct_change = ((recent_mean_events - early_mean_events) / early_mean_events) * 100.0
            insights.append(
                f"Period comparison: Average annual heatwaves changed by {pct_change:+.1f}% "
                f"(from {early_mean_events:.2f} to {recent_mean_events:.2f} events/year) "
                f"between {early_yrs_label} and {recent_yrs_label}."
            )

    # Days trend insight
    days_trend = trends.get("heatwave_days")
    if days_trend and days_trend.slope is not None and days_trend.is_significant:
        insights.append(
            f"Annual heatwave days are increasing significantly at "
            f"{days_trend.slope:+.1f} days/decade (p={days_trend.p_value:.4f})."
        )

    # Peak severity insight
    total_events = sum(m.event_count for m in annual_metrics)
    if total_events == 0:
        insights.append(
            "Zero heatwave events meeting the 3-day 95th-percentile threshold occurred "
            "during the analyzed span."
        )
    else:
        max_duration_year = max(annual_metrics, key=lambda m: m.max_duration_days or 0)
        if max_duration_year.max_duration_days:
            insights.append(
                f"The longest heatwave event lasted {max_duration_year.max_duration_days} "
                f"consecutive days (recorded in {max_duration_year.year})."
            )

    return insights
