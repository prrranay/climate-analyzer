"""Schemas and data transfer objects package."""

from app.schemas.errors import ErrorDetail, ErrorResponse
from app.schemas.requests import HeatwaveAnalysisQuery, RegionSearchQuery
from app.schemas.responses import (
    AnalysisWindowDTO,
    AnnualHeatwaveMetricDTO,
    BaselineConfigDTO,
    DataQualityDTO,
    DataSourceMetadataDTO,
    GeoLocationDTO,
    HeatwaveAnalysisResponse,
    HeatwaveEventDTO,
    TrendStatisticsDTO,
)

__all__ = [
    "ErrorDetail",
    "ErrorResponse",
    "RegionSearchQuery",
    "HeatwaveAnalysisQuery",
    "GeoLocationDTO",
    "DataSourceMetadataDTO",
    "BaselineConfigDTO",
    "DataQualityDTO",
    "HeatwaveEventDTO",
    "AnnualHeatwaveMetricDTO",
    "TrendStatisticsDTO",
    "AnalysisWindowDTO",
    "HeatwaveAnalysisResponse",
]
