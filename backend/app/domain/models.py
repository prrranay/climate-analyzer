"""Core domain models for the Climate Hazard Trend Analyzer.

These models encapsulate pure business logic, entity identities,
and value objects. They are deliberately decoupled from API serialization
and external database storage concerns.
"""

import math
from dataclasses import dataclass, field
from datetime import date
from typing import Literal


@dataclass(slots=True, frozen=True)
class GeoLocation:
    """Geographic location value object."""

    latitude: float
    longitude: float
    name: str | None = None
    country: str | None = None
    country_code: str | None = None
    admin1: str | None = None
    elevation: float | None = None
    timezone: str = "UTC"

    def __post_init__(self) -> None:
        if not (-90.0 <= self.latitude <= 90.0):
            raise ValueError(f"Latitude must be in range [-90.0, 90.0], got {self.latitude}")
        if not (-180.0 <= self.longitude <= 180.0):
            raise ValueError(f"Longitude must be in range [-180.0, 180.0], got {self.longitude}")

    @property
    def coordinate_key(self) -> str:
        """Normalized coordinate string formatted to 4 decimal places."""
        return f"{self.latitude:.4f},{self.longitude:.4f}"


@dataclass(slots=True, frozen=True)
class BoundingBox:
    """Geographic bounding box value object representing a rectangular spatial extent."""

    min_latitude: float
    max_latitude: float
    min_longitude: float
    max_longitude: float

    def __post_init__(self) -> None:
        if not (-90.0 <= self.min_latitude <= 90.0):
            raise ValueError(
                f"min_latitude must be in range [-90.0, 90.0], got {self.min_latitude}"
            )
        if not (-90.0 <= self.max_latitude <= 90.0):
            raise ValueError(
                f"max_latitude must be in range [-90.0, 90.0], got {self.max_latitude}"
            )
        if not (-180.0 <= self.min_longitude <= 180.0):
            raise ValueError(
                f"min_longitude must be in range [-180.0, 180.0], got {self.min_longitude}"
            )
        if not (-180.0 <= self.max_longitude <= 180.0):
            raise ValueError(
                f"max_longitude must be in range [-180.0, 180.0], got {self.max_longitude}"
            )
        if self.min_latitude >= self.max_latitude:
            raise ValueError(
                f"min_latitude ({self.min_latitude}) must be strictly less than "
                f"max_latitude ({self.max_latitude})"
            )
        if self.min_longitude >= self.max_longitude:
            raise ValueError(
                f"min_longitude ({self.min_longitude}) must be strictly less than "
                f"max_longitude ({self.max_longitude})"
            )

    @property
    def lat_span(self) -> float:
        """Latitude span in degrees."""
        return self.max_latitude - self.min_latitude

    @property
    def lon_span(self) -> float:
        """Longitude span in degrees."""
        return self.max_longitude - self.min_longitude

    @property
    def area_square_degrees(self) -> float:
        """Approximate bounding box area in square degrees."""
        return round(self.lat_span * self.lon_span, 4)

    @property
    def canonical_key(self) -> str:
        """Normalized coordinate string formatted to 4 decimal places."""
        return (
            f"{self.min_latitude:.4f},{self.max_latitude:.4f},"
            f"{self.min_longitude:.4f},{self.max_longitude:.4f}"
        )


@dataclass(slots=True, frozen=True)
class DailyWeatherObservation:
    """Daily meteorological observation record.

    Explicitly differentiates valid measured values from missing measurements.
    """

    date: date
    temp_max: float | None
    temp_min: float | None = None
    temp_mean: float | None = None
    unit: str = "°C"
    source_model: str = "ERA5"

    def __post_init__(self) -> None:
        if self.temp_max is not None:
            if math.isnan(self.temp_max) or math.isinf(self.temp_max):
                object.__setattr__(self, "temp_max", None)
            elif not (-100.0 <= self.temp_max <= 70.0):
                # Physical outlier beyond plausible Earth surface temperatures
                object.__setattr__(self, "temp_max", None)

    @property
    def is_valid(self) -> bool:
        """Returns True if primary temperature metric is present."""
        return self.temp_max is not None


@dataclass(slots=True, frozen=True)
class DataQualityStats:
    """Completeness and quality diagnostics for the ingested dataset."""

    total_expected_days: int
    observed_days: int
    missing_days: int
    completeness_ratio: float
    has_critical_gaps: bool
    longest_missing_streak_days: int = 0


@dataclass(slots=True, frozen=True)
class BaselineConfig:
    """Reference baseline configuration for heatwave threshold calculation."""

    baseline_start_year: int
    baseline_end_year: int
    percentile_threshold: float = 95.0
    min_consecutive_days: int = 3
    source_model: str = "ERA5"
    calculated_threshold_celsius: float | None = None

    def __post_init__(self) -> None:
        if self.baseline_start_year >= self.baseline_end_year:
            raise ValueError(
                f"baseline_start_year ({self.baseline_start_year}) must strictly precede "
                f"baseline_end_year ({self.baseline_end_year})"
            )
        if not (0.0 < self.percentile_threshold < 100.0):
            raise ValueError(
                f"percentile_threshold must be between 0 and 100, got {self.percentile_threshold}"
            )
        if self.min_consecutive_days < 1:
            raise ValueError("min_consecutive_days must be at least 1")


@dataclass(slots=True, frozen=True)
class HeatwaveEvent:
    """An individual heatwave hazard event meeting duration and threshold criteria."""

    start_date: date
    end_date: date
    duration_days: int
    threshold_celsius: float
    peak_temperature: float
    peak_exceedance: float
    cumulative_exceedance: float
    mean_exceedance: float
    daily_exceedances: tuple[tuple[date, float], ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.start_date > self.end_date:
            raise ValueError(
                f"start_date ({self.start_date}) cannot follow end_date ({self.end_date})"
            )
        if self.duration_days < 1:
            raise ValueError("duration_days must be at least 1")


@dataclass(slots=True, frozen=True)
class AnnualHeatwaveMetrics:
    """Annual aggregated heatwave statistics.

    Metrics differentiate genuine zero occurrences from undefined/unavailable metrics.
    When event_count == 0, duration and intensity exceedance metrics are None.
    """

    year: int
    event_count: int
    total_heatwave_days: int
    max_duration_days: int | None
    mean_duration_days: float | None
    cumulative_intensity: float | None
    peak_intensity: float | None
    mean_peak_temperature: float | None
    expected_days: int = 365
    usable_days: int = 365
    completeness_percentage: float = 100.0
    quality_status: str = "reliable"


TrendDirection = Literal["increasing", "decreasing", "stable", "indeterminate"]


@dataclass(slots=True, frozen=True)
class TrendStatistics:
    """Statistical trend summary computed over annual hazard metrics."""

    metric_name: str
    slope: float | None
    intercept: float | None
    p_value: float | None
    direction: TrendDirection
    is_significant: bool
    unit: str
    sample_size_years: int
    description: str | None = None


@dataclass(slots=True, frozen=True)
class CompleteAnalysisResult:
    """Aggregated domain analysis output containing all calculated hazard metrics."""

    location: GeoLocation
    baseline: BaselineConfig
    data_quality: DataQualityStats
    events: list[HeatwaveEvent] = field(default_factory=list)
    annual_metrics: list[AnnualHeatwaveMetrics] = field(default_factory=list)
    trends: dict[str, TrendStatistics] = field(default_factory=dict)
    insights: list[str] = field(default_factory=list)
