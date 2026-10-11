"""Domain layer package exporting models, contracts, and pure climate algorithms."""

from app.domain.annual_metrics import aggregate_annual_metrics
from app.domain.contracts import (
    AnalysisCacheProtocol,
    CoverageMetadataRepositoryProtocol,
    GeocodingProviderProtocol,
    HistoricalWeatherProviderProtocol,
    WeatherRepositoryProtocol,
)
from app.domain.detector import detect_heatwave_events
from app.domain.engine import run_climate_hazard_analysis
from app.domain.models import (
    AnnualHeatwaveMetrics,
    BaselineConfig,
    CompleteAnalysisResult,
    DailyWeatherObservation,
    DataQualityStats,
    GeoLocation,
    HeatwaveEvent,
    TrendDirection,
    TrendStatistics,
)
from app.domain.thresholds import calculate_calendar_day_thresholds
from app.domain.trends import (
    calculate_metric_trend,
    compute_all_hazard_trends,
    generate_trend_insights,
)

__all__ = [
    # Models
    "AnnualHeatwaveMetrics",
    "BaselineConfig",
    "CompleteAnalysisResult",
    "DailyWeatherObservation",
    "DataQualityStats",
    "GeoLocation",
    "HeatwaveEvent",
    "TrendDirection",
    "TrendStatistics",
    # Contracts
    "HistoricalWeatherProviderProtocol",
    "GeocodingProviderProtocol",
    "WeatherRepositoryProtocol",
    "AnalysisCacheProtocol",
    "CoverageMetadataRepositoryProtocol",
    # Engine functions
    "calculate_calendar_day_thresholds",
    "detect_heatwave_events",
    "aggregate_annual_metrics",
    "calculate_metric_trend",
    "compute_all_hazard_trends",
    "generate_trend_insights",
    "run_climate_hazard_analysis",
]
