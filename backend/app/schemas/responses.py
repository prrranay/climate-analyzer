"""Response schemas and data-transfer contracts."""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GeoLocationDTO(BaseModel):
    """Geographic entity representation."""

    model_config = ConfigDict(extra="ignore")

    latitude: float = Field(..., description="Latitude coordinate", examples=[52.52])
    longitude: float = Field(..., description="Longitude coordinate", examples=[13.41])
    name: str | None = Field(default=None, description="Location name", examples=["Berlin"])
    country: str | None = Field(default=None, description="Country name", examples=["Germany"])
    country_code: str | None = Field(default=None, description="ISO Country code", examples=["DE"])
    admin1: str | None = Field(
        default=None, description="First-level administrative region", examples=["Berlin"]
    )
    elevation: float | None = Field(
        default=None, description="Elevation above sea level in meters", examples=[34.0]
    )
    timezone: str = Field(
        default="UTC", description="Local timezone string", examples=["Europe/Berlin"]
    )


class DataSourceMetadataDTO(BaseModel):
    """Metadata describing the upstream meteorological reanalysis source."""

    provider: str = Field(
        default="Open-Meteo Historical Weather API",
        description="Public weather API provider",
    )
    dataset: str = Field(
        default="ERA5 Reanalysis",
        description="Atmospheric reanalysis dataset",
    )
    resolution: str = Field(
        default="0.25° (approx. 25-30 km)",
        description="Spatial grid resolution",
    )
    variable: str = Field(
        default="temperature_2m_max",
        description="Surface meteorological parameter evaluated",
    )
    unit: str = Field(default="°C", description="Temperature measurement unit")


class BaselineConfigDTO(BaseModel):
    """Reference climatological baseline parameters."""

    baseline_start_year: int = Field(..., description="Baseline start year", examples=[1991])
    baseline_end_year: int = Field(..., description="Baseline end year", examples=[2020])
    percentile_threshold: float = Field(
        ..., description="Percentile threshold applied", examples=[95.0]
    )
    threshold_celsius: float | None = Field(
        default=None,
        description="Computed regional 95th-percentile threshold in °C (None if not yet computed)",
        examples=[30.45],
    )
    min_consecutive_days: int = Field(
        default=3,
        description="Minimum consecutive days above threshold required for heatwave classification",
    )


class DataQualityDTO(BaseModel):
    """Diagnostics indicating data completeness and observation integrity."""

    total_expected_days: int = Field(..., description="Total calendar days in the query span")
    observed_days: int = Field(..., description="Total days with valid observations")
    missing_days: int = Field(..., description="Total missing or corrupt observation days")
    completeness_percentage: float = Field(
        ...,
        description="Percentage of expected days with valid data [0.0 - 100.0%]",
        examples=[99.85],
    )
    has_critical_gaps: bool = Field(
        ...,
        description=(
            "Flag set when missing data exceeds safe tolerance or has large continuous gaps"
        ),
    )
    longest_missing_streak_days: int = Field(
        default=0,
        description="Maximum consecutive missing days encountered",
    )


class HeatwaveEventDTO(BaseModel):
    """Detailed summary of a single discrete heatwave event."""

    start_date: str = Field(
        ..., description="Event start date (YYYY-MM-DD)", examples=["2003-08-01"]
    )
    end_date: str = Field(..., description="Event end date (YYYY-MM-DD)", examples=["2003-08-12"])
    duration_days: int = Field(..., description="Duration of the event in days", examples=[12])
    threshold_celsius: float = Field(
        ..., description="Applied regional threshold in °C", examples=[30.2]
    )
    peak_temperature_celsius: float = Field(
        ..., description="Highest temperature reached in °C", examples=[37.8]
    )
    peak_exceedance_celsius: float = Field(
        ..., description="Maximum temperature exceedance above threshold", examples=[7.6]
    )
    cumulative_exceedance_degree_days: float = Field(
        ...,
        description="Integrated thermal intensity (degree-days above threshold)",
        examples=[45.2],
    )
    mean_exceedance_celsius: float = Field(
        ..., description="Average daily exceedance above threshold", examples=[3.76]
    )


class AnnualHeatwaveMetricDTO(BaseModel):
    """Annual aggregated hazard summary.

    Note: Distinctly separates genuine zero occurrences (event_count == 0) from
    metrics that are undefined/unavailable when no events occurred (represented as None).
    """

    year: int = Field(..., description="Calendar year", examples=[2022])
    event_count: int = Field(
        ...,
        description="Number of distinct heatwave events (genuine zero if none)",
        examples=[3],
    )
    total_heatwave_days: int = Field(
        ...,
        description="Total days classified in heatwave status",
        examples=[18],
    )
    max_duration_days: int | None = Field(
        default=None,
        description="Maximum event duration in days (None if event_count is 0)",
        examples=[10],
    )
    mean_duration_days: float | None = Field(
        default=None,
        description="Average event duration in days (None if event_count is 0)",
        examples=[6.0],
    )
    cumulative_intensity_degree_days: float | None = Field(
        default=None,
        description="Annual sum of degree-days above threshold (None if event_count is 0)",
        examples=[52.4],
    )
    peak_intensity_celsius: float | None = Field(
        default=None,
        description=(
            "Highest single-day exceedance above threshold in °C (None if event_count is 0)"
        ),
        examples=[6.5],
    )
    mean_peak_temperature_celsius: float | None = Field(
        default=None,
        description=("Average peak temperature of events in that year (None if event_count is 0)"),
        examples=[34.8],
    )
    expected_days: int = Field(default=365, description="Expected calendar days in year")
    usable_days: int = Field(default=365, description="Days with valid measurements")
    completeness_percentage: float = Field(
        default=100.0, description="Annual completeness percentage"
    )
    quality_status: str = Field(
        default="reliable",
        description="Data quality status ('reliable', 'incomplete', 'insufficient_data')",
    )


class TrendStatisticsDTO(BaseModel):
    """Statistical long-term trend summary for a specific hazard metric."""

    metric_name: str = Field(
        ...,
        description="Metric analyzed (e.g. annual_frequency, duration, intensity)",
    )
    slope_per_decade: float | None = Field(
        default=None,
        description="Decadal rate of change (e.g. +0.8 events/decade). None if insufficient data.",
    )
    slope_per_year: float | None = Field(
        default=None,
        description="Annual rate of change. None if insufficient data.",
    )
    intercept: float | None = Field(default=None, description="Regression intercept")
    p_value: float | None = Field(default=None, description="Statistical significance p-value")
    direction: Literal["increasing", "decreasing", "stable", "indeterminate"] = Field(
        default="indeterminate",
        description="Direction of the observed trend",
    )
    is_significant: bool = Field(
        default=False,
        description="Whether the trend is statistically significant (p < 0.05)",
    )
    unit: str = Field(
        ...,
        description="Unit of measurement per time period",
        examples=["events/decade"],
    )
    sample_size_years: int = Field(
        ...,
        description="Total years included in the trend regression",
    )
    description: str | None = Field(
        default=None,
        description="Interpreted text of the trend finding",
    )


class AnalysisWindowDTO(BaseModel):
    """Analysis temporal scope."""

    start_year: int
    end_year: int
    total_years: int


class HeatwaveAnalysisResponse(BaseModel):
    """Complete comprehensive response contract for Climate Hazard Trend Analyzer."""

    location: GeoLocationDTO
    data_source: DataSourceMetadataDTO = Field(default_factory=DataSourceMetadataDTO)
    baseline: BaselineConfigDTO
    analysis_window: AnalysisWindowDTO
    data_quality: DataQualityDTO
    annual_metrics: list[AnnualHeatwaveMetricDTO]
    recent_events: list[HeatwaveEventDTO] = Field(
        default_factory=list,
        description="Recent significant heatwave events in the analyzed period",
    )
    trends: dict[str, TrendStatisticsDTO] = Field(
        default_factory=dict,
        description="Computed long-term trends for frequency, duration, and intensity",
    )
    insights: list[str] = Field(
        default_factory=list,
        description="Human-readable summary observations derived from the metrics",
    )
    generated_at: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat(),
        description="UTC timestamp of response generation",
    )


class BoundingBoxDTO(BaseModel):
    """Bounding box geographic extent representation."""

    min_latitude: float = Field(..., description="Southern latitude", examples=[17.0])
    max_latitude: float = Field(..., description="Northern latitude", examples=[18.0])
    min_longitude: float = Field(..., description="Western longitude", examples=[78.0])
    max_longitude: float = Field(..., description="Eastern longitude", examples=[79.0])
    area_square_degrees: float = Field(
        ..., description="Spatial extent area in square degrees", examples=[1.0]
    )


class SpatialSamplingDTO(BaseModel):
    """Spatial grid sampling configuration and diagnostics."""

    grid_points_count: int = Field(..., description="Number of sampled grid points within the box")
    sample_coordinates: list[GeoLocationDTO] = Field(
        ..., description="Coordinates of all individual sampled points"
    )
    spatial_aggregation_method: str = Field(
        default="daily_spatial_mean",
        description="Method used to derive regional composite timeseries",
    )
    min_point_coverage_ratio: float = Field(
        default=0.60,
        description="Minimum fraction of grid points required to report a valid daily composite",
    )
    spatial_completeness_percentage: float = Field(
        ..., description="Percentage of valid point-day observations across the grid"
    )
    disclaimer: str = Field(
        default=(
            "Regional composite metric derived from deterministic grid sampling. "
            "Not an area-wide continuous surface or point-specific measurement."
        ),
        description="Scientific interpretation disclaimer",
    )


class BoundingBoxHeatwaveAnalysisResponse(BaseModel):
    """Complete response contract for regional bounding-box heatwave analysis."""

    bounding_box: BoundingBoxDTO
    spatial_sampling: SpatialSamplingDTO
    data_source: DataSourceMetadataDTO = Field(default_factory=DataSourceMetadataDTO)
    baseline: BaselineConfigDTO
    analysis_window: AnalysisWindowDTO
    data_quality: DataQualityDTO
    annual_metrics: list[AnnualHeatwaveMetricDTO]
    recent_events: list[HeatwaveEventDTO] = Field(
        default_factory=list,
        description="Recent significant heatwave events detected in the regional composite",
    )
    trends: dict[str, TrendStatisticsDTO] = Field(
        default_factory=dict,
        description="Computed long-term trends for regional heatwaves",
    )
    insights: list[str] = Field(
        default_factory=list,
        description="Human-readable summary observations derived from regional metrics",
    )
    generated_at: str = Field(
        default_factory=lambda: datetime.now(UTC).isoformat(),
        description="UTC timestamp of response generation",
    )
