"""Request schemas and validation models."""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class RegionSearchQuery(BaseModel):
    """Query parameters for searching regions and geocoding."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    query: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Location name or search string (e.g. 'Paris', 'Tokyo')",
        examples=["Berlin"],
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Maximum number of geographic matches to return",
    )


class HeatwaveAnalysisQuery(BaseModel):
    """Validated parameters for heatwave hazard and trend analysis."""

    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="WGS84 latitude coordinate [-90.0 to 90.0]",
        examples=[52.52],
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="WGS84 longitude coordinate [-180.0 to 180.0]",
        examples=[13.41],
    )
    start_year: int = Field(
        ...,
        ge=1940,
        description="Start year for analysis window (ERA5 reanalysis begins in 1940)",
        examples=[1980],
    )
    end_year: int = Field(
        ...,
        description="End year for analysis window (cannot exceed current calendar year)",
        examples=[2023],
    )
    baseline_start_year: int | None = Field(
        default=None,
        ge=1940,
        description=(
            "Optional custom baseline period start year (defaults to configured baseline 1991)"
        ),
        examples=[1991],
    )
    baseline_end_year: int | None = Field(
        default=None,
        ge=1940,
        description=(
            "Optional custom baseline period end year (defaults to configured baseline 2020)"
        ),
        examples=[2020],
    )
    threshold_percentile: float = Field(
        default=95.0,
        ge=80.0,
        le=99.9,
        description="Regional temperature percentile threshold (typically 95.0)",
        examples=[95.0],
    )
    min_consecutive_days: int = Field(
        default=3,
        ge=2,
        le=30,
        description="Minimum consecutive days above threshold to qualify as a heatwave",
        examples=[3],
    )
    model: Literal["ERA5", "ERA5_LAND"] = Field(
        default="ERA5",
        description="Supported reanalysis model source",
        examples=["ERA5"],
    )

    @field_validator("latitude", "longitude")
    @classmethod
    def round_coordinates(cls, v: float) -> float:
        """Round coordinates to 4 decimal places for consistent caching."""
        return round(v, 4)

    @model_validator(mode="after")
    def validate_year_constraints(self) -> "HeatwaveAnalysisQuery":
        """Strict validation of year boundaries without silent clamping."""
        current_year = datetime.now(UTC).year

        # 1. Year order
        if self.start_year > self.end_year:
            raise ValueError(
                f"start_year ({self.start_year}) cannot be greater than end_year ({self.end_year})"
            )

        # 2. Maximum allowable year
        if self.end_year > current_year:
            raise ValueError(
                f"end_year ({self.end_year}) exceeds the current calendar year ({current_year})"
            )

        # 3. Maximum query span duration (e.g., maximum 85 years)
        query_span = self.end_year - self.start_year + 1
        if query_span > 85:
            raise ValueError(
                f"Requested span of {query_span} years exceeds the maximum allowable "
                f"range of 85 years"
            )

        # 4. Baseline validation if custom values provided
        if self.baseline_start_year is not None or self.baseline_end_year is not None:
            if self.baseline_start_year is None or self.baseline_end_year is None:
                raise ValueError(
                    "Both baseline_start_year and baseline_end_year must be provided together"
                )
            if self.baseline_start_year >= self.baseline_end_year:
                raise ValueError(
                    f"baseline_start_year ({self.baseline_start_year}) must strictly precede "
                    f"baseline_end_year ({self.baseline_end_year})"
                )
            if self.baseline_end_year > current_year:
                raise ValueError(
                    f"baseline_end_year ({self.baseline_end_year}) cannot exceed "
                    f"current year ({current_year})"
                )

        return self


class BoundingBoxAnalysisQuery(BaseModel):
    """Validated query parameters for regional bounding-box heatwave analysis."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    min_latitude: float = Field(
        ...,
        alias="min_lat",
        ge=-90.0,
        le=90.0,
        description="Southern bounding latitude [-90.0, 90.0]",
        examples=[17.0],
    )
    max_latitude: float = Field(
        ...,
        alias="max_lat",
        ge=-90.0,
        le=90.0,
        description="Northern bounding latitude [-90.0, 90.0]",
        examples=[18.0],
    )
    min_longitude: float = Field(
        ...,
        alias="min_lon",
        ge=-180.0,
        le=180.0,
        description="Western bounding longitude [-180.0, 180.0]",
        examples=[78.0],
    )
    max_longitude: float = Field(
        ...,
        alias="max_lon",
        ge=-180.0,
        le=180.0,
        description="Eastern bounding longitude [-180.0, 180.0]",
        examples=[79.0],
    )
    start_year: int = Field(
        ...,
        ge=1940,
        description="First year of requested analysis period (inclusive)",
        examples=[2000],
    )
    end_year: int = Field(
        ...,
        ge=1940,
        description="Last year of requested analysis period (inclusive)",
        examples=[2005],
    )
    baseline_start_year: int | None = Field(
        default=None,
        ge=1940,
        description="Optional custom baseline start year",
        examples=[1991],
    )
    baseline_end_year: int | None = Field(
        default=None,
        ge=1940,
        description="Optional custom baseline end year",
        examples=[2020],
    )
    threshold_percentile: float = Field(
        default=95.0,
        ge=50.0,
        le=99.9,
        description="Percentile threshold for heatwave detection",
        examples=[95.0],
    )
    min_consecutive_days: int = Field(
        default=3,
        ge=2,
        le=30,
        description="Minimum consecutive days above threshold to qualify as a heatwave",
        examples=[3],
    )
    model: Literal["ERA5", "ERA5_LAND"] = Field(
        default="ERA5",
        description="Supported reanalysis model source",
        examples=["ERA5"],
    )

    @field_validator("min_latitude", "max_latitude", "min_longitude", "max_longitude")
    @classmethod
    def round_coordinates(cls, v: float) -> float:
        """Round coordinates to 4 decimal places for consistent spatial keying."""
        return round(v, 4)

    @model_validator(mode="after")
    def validate_spatial_and_temporal_constraints(self) -> "BoundingBoxAnalysisQuery":
        """Strict validation of spatial bounding-box geometry and temporal ranges."""
        # 1. Coordinate ordering
        if self.min_latitude >= self.max_latitude:
            raise ValueError(
                f"min_lat ({self.min_latitude}) must be strictly less than "
                f"max_lat ({self.max_latitude})"
            )
        if self.min_longitude >= self.max_longitude:
            raise ValueError(
                f"min_lon ({self.min_longitude}) must be strictly less than "
                f"max_lon ({self.max_longitude})"
            )

        # 2. Maximum area limit (max 25.0 square degrees)
        lat_span = self.max_latitude - self.min_latitude
        lon_span = self.max_longitude - self.min_longitude
        area = lat_span * lon_span
        if area > 25.0:
            raise ValueError(
                f"Bounding box area ({area:.2f} deg²) exceeds maximum allowed limit of 25.00 deg²"
            )

        # 3. Year constraints
        current_year = datetime.now(UTC).year
        if self.start_year > self.end_year:
            raise ValueError(
                f"start_year ({self.start_year}) cannot be greater than end_year ({self.end_year})"
            )
        if self.end_year > current_year:
            raise ValueError(
                f"end_year ({self.end_year}) exceeds the current calendar year ({current_year})"
            )
        query_span = self.end_year - self.start_year + 1
        if query_span > 85:
            raise ValueError(
                f"Requested span of {query_span} years exceeds maximum allowable range of 85 years"
            )

        # 4. Baseline constraints
        if self.baseline_start_year is not None or self.baseline_end_year is not None:
            if self.baseline_start_year is None or self.baseline_end_year is None:
                raise ValueError(
                    "Both baseline_start_year and baseline_end_year must be provided together"
                )
            if self.baseline_start_year >= self.baseline_end_year:
                raise ValueError(
                    f"baseline_start_year ({self.baseline_start_year}) must strictly precede "
                    f"baseline_end_year ({self.baseline_end_year})"
                )
            if self.baseline_end_year > current_year:
                raise ValueError(
                    f"baseline_end_year ({self.baseline_end_year}) cannot exceed "
                    f"current year ({current_year})"
                )

        return self
