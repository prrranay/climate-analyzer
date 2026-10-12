import asyncio
import hashlib
import logging
from datetime import date, timedelta

from app.cache.keys import generate_analysis_cache_key, generate_bbox_cache_key
from app.core.config import Settings, get_settings
from app.domain.contracts import AnalysisCacheProtocol
from app.domain.engine import run_climate_hazard_analysis
from app.domain.grid import generate_bounding_box_grid
from app.domain.models import BaselineConfig, BoundingBox, GeoLocation
from app.domain.spatial_aggregation import aggregate_grid_daily_series
from app.schemas.requests import BoundingBoxAnalysisQuery, HeatwaveAnalysisQuery
from app.schemas.responses import (
    AnalysisWindowDTO,
    AnnualHeatwaveMetricDTO,
    BaselineConfigDTO,
    BoundingBoxDTO,
    BoundingBoxHeatwaveAnalysisResponse,
    DataQualityDTO,
    DataSourceMetadataDTO,
    GeoLocationDTO,
    HeatwaveAnalysisResponse,
    HeatwaveEventDTO,
    SpatialSamplingDTO,
    TrendStatisticsDTO,
)
from app.services.weather_service import WeatherService

logger = logging.getLogger(__name__)


class AnalysisService:
    """Orchestrates end-to-end heatwave hazard trend analysis workflow."""

    def __init__(
        self,
        weather_service: WeatherService,
        cache: AnalysisCacheProtocol | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._weather_service = weather_service
        self._cache = cache
        self._settings = settings or get_settings()

    async def analyze_heatwaves(self, query: HeatwaveAnalysisQuery) -> HeatwaveAnalysisResponse:
        """Execute full heatwave analysis pipeline with deterministic Redis caching."""
        # 1. Determine baseline bounds and canonical location
        b_start = query.baseline_start_year or self._settings.baseline_start_year
        b_end = query.baseline_end_year or self._settings.baseline_end_year
        location = GeoLocation(latitude=query.latitude, longitude=query.longitude)

        # 2. Determine required date span ensuring baseline and analysis are both available,
        # with boundary buffers to prevent event truncation across analysis year limits.
        boundary_buffer_days = max(query.min_consecutive_days, 15)
        full_start_date = min(
            date(query.start_year, 1, 1) - timedelta(days=boundary_buffer_days),
            date(b_start, 1, 1),
        )
        full_end_date = max(
            date(query.end_year, 12, 31) + timedelta(days=boundary_buffer_days),
            date(b_end, 12, 31),
        )

        baseline_config = BaselineConfig(
            baseline_start_year=b_start,
            baseline_end_year=b_end,
            percentile_threshold=query.threshold_percentile,
            min_consecutive_days=query.min_consecutive_days,
            source_model=query.model,
        )

        # 3. Ensure required source data is available before relying on cache or computing
        observations = await self._weather_service.ensure_historical_observations(
            location=location,
            start_date=full_start_date,
            end_date=full_end_date,
            model=query.model,
        )

        # 4. Efficient dataset version lookup for safe cache keying & automatic invalidation
        dataset_version = await self._weather_service.get_dataset_version(
            location=location, model=query.model
        )

        # 5. Deterministic canonical cache key
        cache_key = generate_analysis_cache_key(
            latitude=location.latitude,
            longitude=location.longitude,
            start_year=query.start_year,
            end_year=query.end_year,
            baseline_start_year=b_start,
            baseline_end_year=b_end,
            threshold_percentile=query.threshold_percentile,
            min_consecutive_days=query.min_consecutive_days,
            threshold_method="climatological_moving_window_15d",
            source="Open-Meteo",
            model=query.model,
            algorithm_version=self._settings.analysis_algorithm_version,
            dataset_version=dataset_version,
        )

        # 6. Check cache if available, validating schema before returning
        if self._cache is not None:
            cached_data = await self._cache.get_analysis(cache_key)
            if cached_data is not None:
                try:
                    cached_response = HeatwaveAnalysisResponse.model_validate(cached_data)
                    logger.info("Analysis cache hit for key '%s'", cache_key[:36])
                    return cached_response
                except Exception as exc:
                    logger.warning(
                        "Cached analysis failed schema validation (%s); discarding cache entry.",
                        exc,
                    )
            else:
                logger.info("Analysis cache miss for key '%s'", cache_key[:36])

        # 7. Execute pure domain climate analysis
        analysis_result = run_climate_hazard_analysis(
            location=location,
            observations=observations,
            baseline_config=baseline_config,
            analysis_start_year=query.start_year,
            analysis_end_year=query.end_year,
            min_consecutive_days=query.min_consecutive_days,
        )

        # 7. Construct response DTO
        response = HeatwaveAnalysisResponse(
            location=GeoLocationDTO(
                latitude=location.latitude,
                longitude=location.longitude,
                name=location.name,
                country=location.country,
                country_code=location.country_code,
                admin1=location.admin1,
                elevation=location.elevation,
                timezone=location.timezone,
            ),
            data_source=DataSourceMetadataDTO(
                provider="Open-Meteo Historical Weather API",
                dataset=f"{query.model} Reanalysis",
                variable="temperature_2m_max",
                unit="°C",
            ),
            baseline=BaselineConfigDTO(
                baseline_start_year=b_start,
                baseline_end_year=b_end,
                percentile_threshold=query.threshold_percentile,
                threshold_celsius=analysis_result.baseline.calculated_threshold_celsius,
                min_consecutive_days=query.min_consecutive_days,
            ),
            analysis_window=AnalysisWindowDTO(
                start_year=query.start_year,
                end_year=query.end_year,
                total_years=query.end_year - query.start_year + 1,
            ),
            data_quality=DataQualityDTO(
                total_expected_days=analysis_result.data_quality.total_expected_days,
                observed_days=analysis_result.data_quality.observed_days,
                missing_days=analysis_result.data_quality.missing_days,
                completeness_percentage=round(
                    analysis_result.data_quality.completeness_ratio * 100.0, 2
                ),
                has_critical_gaps=analysis_result.data_quality.has_critical_gaps,
                longest_missing_streak_days=analysis_result.data_quality.longest_missing_streak_days,
            ),
            annual_metrics=[
                AnnualHeatwaveMetricDTO(
                    year=m.year,
                    event_count=m.event_count,
                    total_heatwave_days=m.total_heatwave_days,
                    max_duration_days=m.max_duration_days,
                    mean_duration_days=m.mean_duration_days,
                    cumulative_intensity_degree_days=m.cumulative_intensity,
                    peak_intensity_celsius=m.peak_intensity,
                    mean_peak_temperature_celsius=m.mean_peak_temperature,
                    expected_days=m.expected_days,
                    usable_days=m.usable_days,
                    completeness_percentage=m.completeness_percentage,
                    quality_status=m.quality_status,
                )
                for m in analysis_result.annual_metrics
            ],
            recent_events=[
                HeatwaveEventDTO(
                    start_date=ev.start_date.isoformat(),
                    end_date=ev.end_date.isoformat(),
                    duration_days=ev.duration_days,
                    threshold_celsius=ev.threshold_celsius,
                    peak_temperature_celsius=ev.peak_temperature,
                    peak_exceedance_celsius=ev.peak_exceedance,
                    cumulative_exceedance_degree_days=ev.cumulative_exceedance,
                    mean_exceedance_celsius=ev.mean_exceedance,
                )
                for ev in analysis_result.events[-10:]  # most recent 10 events
            ],
            trends={
                name: TrendStatisticsDTO(
                    metric_name=name,
                    slope_per_decade=trend.slope,
                    slope_per_year=(
                        round(trend.slope / 10.0, 4) if trend.slope is not None else None
                    ),
                    intercept=trend.intercept,
                    p_value=trend.p_value,
                    direction=trend.direction,
                    is_significant=trend.is_significant,
                    unit=trend.unit,
                    sample_size_years=trend.sample_size_years,
                    description=trend.description,
                )
                for name, trend in analysis_result.trends.items()
            },
            insights=analysis_result.insights,
        )

        # 8. Persist to Redis cache with configurable TTL
        if self._cache is not None:
            await self._cache.set_analysis(
                cache_key, response.model_dump(), ttl_seconds=self._settings.cache_ttl_seconds
            )

        return response

    async def analyze_bounding_box_heatwaves(
        self, query: BoundingBoxAnalysisQuery
    ) -> BoundingBoxHeatwaveAnalysisResponse:
        """Execute regional bounding-box heatwave analysis with spatial grid sampling."""
        # 1. Parse and validate bounding box extent
        box = BoundingBox(
            min_latitude=query.min_latitude,
            max_latitude=query.max_latitude,
            min_longitude=query.min_longitude,
            max_longitude=query.max_longitude,
        )

        b_start = query.baseline_start_year or self._settings.baseline_start_year
        b_end = query.baseline_end_year or self._settings.baseline_end_year
        boundary_buffer_days = max(query.min_consecutive_days, 15)
        full_start_date = min(
            date(query.start_year, 1, 1) - timedelta(days=boundary_buffer_days),
            date(b_start, 1, 1),
        )
        full_end_date = max(
            date(query.end_year, 12, 31) + timedelta(days=boundary_buffer_days),
            date(b_end, 12, 31),
        )

        baseline_config = BaselineConfig(
            baseline_start_year=b_start,
            baseline_end_year=b_end,
            percentile_threshold=query.threshold_percentile,
            min_consecutive_days=query.min_consecutive_days,
            source_model=query.model,
        )

        # 2. Generate deterministic regular sample grid within bounding box
        sample_points = generate_bounding_box_grid(
            box=box,
            max_points=self._settings.max_bbox_sample_points,
        )

        # 3. Ingest/retrieve observations concurrently for every canonical sample point
        fetch_tasks = [
            self._weather_service.ensure_historical_observations(
                location=point,
                start_date=full_start_date,
                end_date=full_end_date,
                model=query.model,
            )
            for point in sample_points
        ]
        results = await asyncio.gather(*fetch_tasks)
        grid_observations = {
            point.coordinate_key: obs for point, obs in zip(sample_points, results, strict=True)
        }

        # 4. Dataset version token lookup across all points for composite cache key
        version_tasks = [
            self._weather_service.get_dataset_version(location=point, model=query.model)
            for point in sample_points
        ]
        versions = await asyncio.gather(*version_tasks)
        composite_token = hashlib.sha256(
            "".join(
                f"{p.coordinate_key}:{v}" for p, v in zip(sample_points, versions, strict=True)
            ).encode("utf-8")
        ).hexdigest()[:16]
        composite_dataset_version = f"comp_{composite_token}"

        # 5. Deterministic canonical cache key for regional bounding-box result
        cache_key = generate_bbox_cache_key(
            min_latitude=box.min_latitude,
            max_latitude=box.max_latitude,
            min_longitude=box.min_longitude,
            max_longitude=box.max_longitude,
            grid_point_keys=[p.coordinate_key for p in sample_points],
            start_year=query.start_year,
            end_year=query.end_year,
            baseline_start_year=b_start,
            baseline_end_year=b_end,
            threshold_percentile=query.threshold_percentile,
            min_consecutive_days=query.min_consecutive_days,
            threshold_method="climatological_moving_window_15d",
            spatial_aggregation_method="daily_spatial_mean",
            min_point_coverage_ratio=self._settings.min_bbox_point_coverage_ratio,
            source="Open-Meteo",
            model=query.model,
            algorithm_version=self._settings.analysis_algorithm_version,
            composite_dataset_version=composite_dataset_version,
        )

        # 6. Check cache if available
        if self._cache is not None:
            cached_data = await self._cache.get_analysis(cache_key)
            if cached_data is not None:
                try:
                    cached_response = BoundingBoxHeatwaveAnalysisResponse.model_validate(
                        cached_data
                    )
                    logger.info("BBox analysis cache hit for key '%s'", cache_key[:40])
                    return cached_response
                except Exception as exc:
                    logger.warning(
                        "Cached bbox analysis failed validation (%s); discarding cache entry.",
                        exc,
                    )
            else:
                logger.info("BBox analysis cache miss for key '%s'", cache_key[:40])

        # 7. Aggregate grid daily observations into composite regional series
        composite_series, spatial_completeness_pct = aggregate_grid_daily_series(
            grid_observations=grid_observations,
            min_coverage_ratio=self._settings.min_bbox_point_coverage_ratio,
            source_model=query.model,
        )

        # 8. Compute centroid location for representative metadata
        centroid_lat = round((box.min_latitude + box.max_latitude) / 2.0, 4)
        centroid_lon = round((box.min_longitude + box.max_longitude) / 2.0, 4)
        centroid = GeoLocation(latitude=centroid_lat, longitude=centroid_lon)

        # 9. Execute pure domain climate analysis on composite regional series
        analysis_result = run_climate_hazard_analysis(
            location=centroid,
            observations=composite_series,
            baseline_config=baseline_config,
            analysis_start_year=query.start_year,
            analysis_end_year=query.end_year,
            min_consecutive_days=query.min_consecutive_days,
        )

        # 10. Construct regional response DTO
        response = BoundingBoxHeatwaveAnalysisResponse(
            bounding_box=BoundingBoxDTO(
                min_latitude=box.min_latitude,
                max_latitude=box.max_latitude,
                min_longitude=box.min_longitude,
                max_longitude=box.max_longitude,
                area_square_degrees=box.area_square_degrees,
            ),
            spatial_sampling=SpatialSamplingDTO(
                grid_points_count=len(sample_points),
                sample_coordinates=[
                    GeoLocationDTO(
                        latitude=p.latitude,
                        longitude=p.longitude,
                        timezone="UTC",
                    )
                    for p in sample_points
                ],
                spatial_aggregation_method="daily_spatial_mean",
                min_point_coverage_ratio=self._settings.min_bbox_point_coverage_ratio,
                spatial_completeness_percentage=spatial_completeness_pct,
                disclaimer=(
                    "Regional composite metric derived from deterministic grid sampling. "
                    "Not an area-wide continuous surface or point-specific measurement."
                ),
            ),
            data_source=DataSourceMetadataDTO(
                provider="Open-Meteo Historical Weather API",
                dataset=f"{query.model} Reanalysis",
                variable="temperature_2m_max",
                unit="°C",
            ),
            baseline=BaselineConfigDTO(
                baseline_start_year=b_start,
                baseline_end_year=b_end,
                percentile_threshold=query.threshold_percentile,
                threshold_celsius=analysis_result.baseline.calculated_threshold_celsius,
                min_consecutive_days=query.min_consecutive_days,
            ),
            analysis_window=AnalysisWindowDTO(
                start_year=query.start_year,
                end_year=query.end_year,
                total_years=query.end_year - query.start_year + 1,
            ),
            data_quality=DataQualityDTO(
                total_expected_days=analysis_result.data_quality.total_expected_days,
                observed_days=analysis_result.data_quality.observed_days,
                missing_days=analysis_result.data_quality.missing_days,
                completeness_percentage=round(
                    analysis_result.data_quality.completeness_ratio * 100.0, 2
                ),
                has_critical_gaps=analysis_result.data_quality.has_critical_gaps,
                longest_missing_streak_days=analysis_result.data_quality.longest_missing_streak_days,
            ),
            annual_metrics=[
                AnnualHeatwaveMetricDTO(
                    year=m.year,
                    event_count=m.event_count,
                    total_heatwave_days=m.total_heatwave_days,
                    max_duration_days=m.max_duration_days,
                    mean_duration_days=m.mean_duration_days,
                    cumulative_intensity_degree_days=m.cumulative_intensity,
                    peak_intensity_celsius=m.peak_intensity,
                    mean_peak_temperature_celsius=m.mean_peak_temperature,
                    expected_days=m.expected_days,
                    usable_days=m.usable_days,
                    completeness_percentage=m.completeness_percentage,
                    quality_status=m.quality_status,
                )
                for m in analysis_result.annual_metrics
            ],
            recent_events=[
                HeatwaveEventDTO(
                    start_date=ev.start_date.isoformat(),
                    end_date=ev.end_date.isoformat(),
                    duration_days=ev.duration_days,
                    threshold_celsius=ev.threshold_celsius,
                    peak_temperature_celsius=ev.peak_temperature,
                    peak_exceedance_celsius=ev.peak_exceedance,
                    cumulative_exceedance_degree_days=ev.cumulative_exceedance,
                    mean_exceedance_celsius=ev.mean_exceedance,
                )
                for ev in analysis_result.events[-10:]
            ],
            trends={
                name: TrendStatisticsDTO(
                    metric_name=name,
                    slope_per_decade=trend.slope,
                    slope_per_year=(
                        round(trend.slope / 10.0, 4) if trend.slope is not None else None
                    ),
                    intercept=trend.intercept,
                    p_value=trend.p_value,
                    direction=trend.direction,
                    is_significant=trend.is_significant,
                    unit=trend.unit,
                    sample_size_years=trend.sample_size_years,
                    description=trend.description,
                )
                for name, trend in analysis_result.trends.items()
            },
            insights=analysis_result.insights,
        )

        # 11. Cache response
        if self._cache is not None:
            await self._cache.set_analysis(
                cache_key, response.model_dump(), ttl_seconds=self._settings.cache_ttl_seconds
            )

        return response
