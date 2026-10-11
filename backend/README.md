# Climate Hazard Trend Analyzer Backend

A production-grade, asynchronous Python backend for ingesting historical meteorological reanalysis data, detecting regional heatwaves, analyzing hazard intensity and duration, and computing honest climatological hazard trends.

Built with **FastAPI**, **Pydantic v2**, **PyMongo Async**, **Redis asyncio**, **HTTPX**, and **NumPy/SciPy**.

---

## 1. Project Purpose & Supported Functionality

The Climate Hazard Trend Analyzer provides verifiable, scientifically grounded climate hazard intelligence for municipalities, infrastructure planners, and researchers.

### Key Functionality
- **Geographic Location Search**: Autocomplete geocoding resolving cities and administrative regions to high-precision WGS-84 coordinates.
- **Meteorological Data Ingestion**: Automated ingestion of daily maximum temperatures ($T_{\text{max}}$) from the Open-Meteo Historical Weather API using the ECMWF ERA5 global atmospheric reanalysis model.
- **Stationary Baseline Climatology**: Calculation of localized, calendar-day 95th-percentile temperature thresholds based on an internationally accepted stationary normal (default `1991–2020`).
- **Consecutive-Day Heatwave Detection**: Identification of qualifying heatwave events ($\ge 3$ consecutive days strictly exceeding the climatological threshold).
- **Annual Hazard Aggregation**: Derivation of annual event frequency, cumulative heatwave days, maximum/mean duration, cumulative exceedance intensity (°C-days), and peak temperatures.
- **Honest Statistical Trend Analysis**: Ordinary Least Squares (OLS) linear regression reporting rates of change per decade, accompanied by two-tailed hypothesis testing ($p$-values, $\alpha = 0.05$) and zero-baseline division protection.
- **Multi-Tier Performance Architecture**: Redis caching with deterministic parameter hashing, automatic dataset-revision invalidation, and atomic fixed-window rate limiting.

---

## 2. Architecture & Component Diagram

The application is engineered using a clean, layered architecture that strictly separates transport, orchestration, business logic, and infrastructure:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             HTTP Clients / Web UI                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / JSON
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                              API / Transport Layer                          │
│   • FastAPI Router (app/api/v1/router.py)                                   │
│   • Thin Handlers: /regions/search, /analysis/heatwave, /health/*           │
│   • Rate Limiting Dependency (Redis Atomic Lua)                             │
│   • Standard Error Handling & Request Timing Middleware                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            Application Services                             │
│   • RegionService: Coordinate search & provider error mapping               │
│   • WeatherService: Ingestion orchestration, range segmentation & reuse     │
│   • AnalysisService: Workflow owner, deterministic caching & response assembly│
└──────────────┬───────────────────────────────────────────────┬──────────────┘
               │                                               │
┌──────────────▼──────────────┐                 ┌──────────────▼──────────────┐
│    Pure Domain Engine       │                 │     Infrastructure Layer    │
│ (Zero External Dependencies)│                 │                             │
│ • thresholds.py: 15-day T95 │                 │ • MongoDB (PyMongo Async)   │
│ • detector.py: Streak logic │                 │   - weather_observations    │
│ • annual_metrics.py: Stats  │                 │   - baseline_thresholds     │
│ • trends.py: OLS & p-values │                 │   - coverage_metadata       │
│ • models.py: Domain entities│                 │ • Redis (redis-py asyncio)  │
└─────────────────────────────┘                 │   - Analysis response cache │
                                                │   - Atomic fixed-window rate│
                                                │ • HTTPX Client Pool         │
                                                │   - Open-Meteo Reanalysis   │
                                                │   - Open-Meteo Geocoding    │
                                                └─────────────────────────────┘
```

---

## 3. Technology Choices & Justification

| Technology | Purpose | Justification |
| :--- | :--- | :--- |
| **Python 3.12+** | Core Runtime | Modern asynchronous primitives, native generic typing, and battle-tested scientific computing libraries. |
| **FastAPI** | ASGI Web Framework | High-throughput async request handling, automated OpenAPI 3.1 generation, and first-class dependency injection. |
| **Pydantic v2 & Pydantic-Settings** | DTO Validation & Configuration | Strict boundary validation, fast Rust-based core deserialization, and type-safe environment variable mapping. |
| **PyMongo Async API** | NoSQL Data Persistence | Official modern non-blocking MongoDB driver for Python, eliminating event-loop blocking during large timeseries lookups. |
| **Redis (redis-py asyncio)** | Cache & Rate Limiting | Sub-millisecond response caching and atomic Lua-scripted rate limiting across multi-worker deployments. |
| **HTTPX** | External API Adapter | Fully async HTTP client supporting persistent connection pooling, configurable timeouts, and exponential backoff retry. |
| **NumPy & SciPy** | Mathematical Engine | Vectorized percentile interpolation and robust statistical linear regression with exact two-tailed $p$-values. |
| **Ruff & Pytest** | Code Quality & Testing | Instantaneous static linting, PEP 8 formatting, and comprehensive async test execution with mock dependency overrides. |

---

## 4. Local Setup Instructions

### Prerequisites
- Python 3.12 or newer installed.
- Git.
- MongoDB (running on `localhost:27017` or via Docker Compose).
- Redis (running on `localhost:6379` or via Docker Compose).

---

### Windows (PowerShell)

```powershell
# 1. Clone repository and navigate to backend directory
cd path\to\dygnify\backend

# 2. Create Python virtual environment
python -m venv .venv

# 3. Activate virtual environment
.\.venv\Scripts\Activate.ps1

# 4. Install backend package and development dependencies in editable mode
pip install --upgrade pip
pip install -e .

# 5. Create local environment file from template
Copy-Item .env.example .env

# 6. Start the API development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

### Unix-like Environments (Linux / macOS Bash)

```bash
# 1. Navigate to backend directory
cd path/to/dygnify/backend

# 2. Create Python virtual environment
python3 -m venv .venv

# 3. Activate virtual environment
source .venv/bin/activate

# 4. Install backend package and dependencies
pip install --upgrade pip
pip install -e .

# 5. Create local environment file from template
cp .env.example .env

# 6. Start the API development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 5. Environment Variables

All settings are strongly typed and validated at boot using [pydantic-settings](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/core/config.py). Configure these variables in `.env`:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `APP_NAME` | string | `Climate Hazard Trend Analyzer` | Name of the application service. |
| `ENVIRONMENT` | string | `development` | Deployment tier: `development`, `staging`, or `production`. |
| `DEBUG` | boolean | `false` | Enables verbose debug logging and diagnostics. |
| `PORT` | integer | `8000` | Port bound by the HTTP server. |
| `HOST` | string | `0.0.0.0` | Host interface bound by the HTTP server. |
| `MONGODB_URI` | string | `mongodb://localhost:27017` | MongoDB connection URI with pool parameters. |
| `MONGODB_DB_NAME` | string | `climate_hazards` | Database name for observations and coverage. |
| `REDIS_URL` | string | `redis://localhost:6379/0` | Redis connection URL. |
| `OPEN_METEO_HISTORICAL_API_URL` | string | `https://archive-api.open-meteo.com/v1/archive` | Base URL for Open-Meteo ERA5 archive. |
| `OPEN_METEO_GEOCODING_API_URL` | string | `https://geocoding-api.open-meteo.com/v1/search` | Base URL for Open-Meteo Geocoding search. |
| `HTTP_TIMEOUT_SECONDS` | float | `30.0` | Socket and response timeout for external HTTP calls. |
| `HTTP_MAX_RETRIES` | integer | `3` | Max retry attempts for transient 429/5xx external errors. |
| `HTTP_BACKOFF_FACTOR` | float | `0.5` | Exponential backoff delay multiplier. |
| `BASELINE_START_YEAR` | integer | `1991` | Fixed reference baseline start year (ERA5 default). |
| `BASELINE_END_YEAR` | integer | `2020` | Fixed reference baseline end year (ERA5 default). |
| `MIN_ANALYSIS_YEAR` | integer | `1940` | Earliest permitted historical year (ERA5 starts 1940). |
| `MAX_ANALYSIS_RANGE_YEARS` | integer | `85` | Maximum year span allowed in a single request. |
| `DATA_LAG_BUFFER_DAYS` | integer | `5` | Guard buffer accounting for ERA5 reanalysis delay. |
| `RATE_LIMIT_ENABLED` | boolean | `true` | Toggles Redis-backed API rate limiting. |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | integer | `60` | Default rate limit request threshold per minute. |
| `RATE_LIMIT_ANALYSIS_RPM` | integer | `30` | Rate limit quota for heavy heatwave analysis endpoints. |
| `RATE_LIMIT_REGIONS_RPM` | integer | `60` | Rate limit quota for geocoding search endpoints. |
| `RATE_LIMIT_WINDOW_SECONDS` | integer | `60` | Fixed window duration in seconds for rate counters. |
| `TRUSTED_PROXIES` | list[str] | `[]` | List of reverse proxy IPs permitted to set `X-Forwarded-For`. |
| `CACHE_TTL_SECONDS` | integer | `86400` | Expiration TTL (seconds) for cached hazard analyses (24h). |
| `ANALYSIS_ALGORITHM_VERSION` | string | `v1.0.0` | Algorithm version embedded into cache keys. |
| `CORS_ORIGINS` | list[str] | `["http://localhost:3000", ...]` | Allowed CORS origins (JSON array or comma-separated). |

---

## 6. Docker Compose Configuration

The project includes a multi-service [docker-compose.yml](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/docker-compose.yml) orchestrating persistent storage and the backend:

```bash
# 1. Start MongoDB and Redis background containers
docker compose up -d mongodb redis

# 2. Check health status of the database and cache
docker compose ps

# 3. Optionally launch the full stack including containerized API
docker compose up --build
```

---

## 7. Quality Checks: Running Tests, Linting & Type Checks

```bash
# Run the complete test suite (78 tests)
pytest -v

# Run with full line-by-line coverage report
pytest --cov=app --cov-report=term-missing

# Run Ruff linter checks
ruff check app tests

# Run Ruff code format checks
ruff format --check app tests

# Auto-format all Python files to project standards
ruff format app tests
```

---

## 8. OpenAPI / Swagger Documentation

When running locally in non-production environments (`ENVIRONMENT != "production"`), interactive API documentation is automatically generated:

- **Swagger UI Interactive Explorer**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Raw OpenAPI 3.1 JSON Schema**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

---

## 9. API Endpoint Reference

### 1. `GET /api/v1/regions/search`
Search for geographic locations by query string.

- **Query Parameters**:
  - `q` (string, required, length: 2–100): City or region name (e.g., `Hyderabad`).
  - `count` (integer, optional, default: 5, range: 1–20): Maximum matches to return.
- **Example Request**:
  ```http
  GET /api/v1/regions/search?q=Hyderabad&count=1 HTTP/1.1
  Host: localhost:8000
  ```
- **Sanitized Response (200 OK)**:
  ```json
  [
    {
      "latitude": 17.384,
      "longitude": 78.4564,
      "name": "Hyderabad",
      "country": "India",
      "country_code": "IN",
      "admin1": "Telangana",
      "elevation": 505.0,
      "timezone": "Asia/Kolkata"
    }
  ]
  ```

---

### 2. `GET /api/v1/analysis/heatwave`
Execute heatwave hazard analysis and trend regression for coordinates and year span.

- **Query Parameters**:
  - `latitude` (float, required, range: -90.0 to 90.0): Target latitude.
  - `longitude` (float, required, range: -180.0 to 180.0): Target longitude.
  - `start_year` (integer, required, $\ge 1940$): Beginning analysis year.
  - `end_year` (integer, required, $\le \text{current year} - \text{lag}$): Ending analysis year.
  - `baseline_start_year` (integer, optional, default: 1991): Baseline start year.
  - `baseline_end_year` (integer, optional, default: 2020): Baseline end year.
  - `threshold_percentile` (float, optional, default: 95.0, range: 50.0–99.9): Percentile threshold.
  - `min_consecutive_days` (integer, optional, default: 3, range: 2–14): Minimum heatwave run length.
- **Example Request**:
  ```http
  GET /api/v1/analysis/heatwave?latitude=17.385&longitude=78.487&start_year=2000&end_year=2005 HTTP/1.1
  Host: localhost:8000
  ```
- **Sanitized Response (200 OK)**:
  ```json
  {
    "location": {
      "latitude": 17.385,
      "longitude": 78.487,
      "name": null,
      "country": null,
      "country_code": null,
      "admin1": null,
      "elevation": null,
      "timezone": "UTC"
    },
    "data_source": {
      "provider": "Open-Meteo Historical Weather API",
      "dataset": "ERA5 Reanalysis",
      "variable": "temperature_2m_max",
      "unit": "°C"
    },
    "baseline": {
      "baseline_start_year": 1991,
      "baseline_end_year": 2020,
      "percentile_threshold": 95.0,
      "threshold_celsius": 39.4,
      "min_consecutive_days": 3
    },
    "analysis_window": {
      "start_year": 2000,
      "end_year": 2005,
      "total_years": 6
    },
    "data_quality": {
      "total_expected_days": 2192,
      "observed_days": 2192,
      "missing_days": 0,
      "completeness_percentage": 100.0,
      "has_critical_gaps": false,
      "longest_missing_streak_days": 0
    },
    "annual_metrics": [
      {
        "year": 2000,
        "event_count": 0,
        "total_heatwave_days": 0,
        "max_duration_days": null,
        "mean_duration_days": null,
        "cumulative_intensity_degree_days": 0.0,
        "peak_intensity_celsius": null,
        "mean_peak_temperature_celsius": null,
        "expected_days": 366,
        "usable_days": 366,
        "completeness_percentage": 100.0,
        "quality_status": "reliable"
      },
      {
        "year": 2003,
        "event_count": 1,
        "total_heatwave_days": 4,
        "max_duration_days": 4,
        "mean_duration_days": 4.0,
        "cumulative_intensity_degree_days": 6.8,
        "peak_intensity_celsius": 2.1,
        "mean_peak_temperature_celsius": 41.5,
        "expected_days": 365,
        "usable_days": 365,
        "completeness_percentage": 100.0,
        "quality_status": "reliable"
      }
    ],
    "recent_events": [
      {
        "start_date": "2003-05-18",
        "end_date": "2003-05-21",
        "duration_days": 4,
        "threshold_celsius": 39.4,
        "peak_temperature_celsius": 41.5,
        "peak_exceedance_celsius": 2.1,
        "cumulative_exceedance_degree_days": 6.8,
        "mean_exceedance_celsius": 1.7
      }
    ],
    "trends": {
      "annual_frequency": {
        "metric_name": "annual_frequency",
        "slope_per_decade": 0.2857,
        "slope_per_year": 0.0286,
        "intercept": -0.1429,
        "p_value": 0.3842,
        "direction": "increasing",
        "is_significant": false,
        "unit": "events/decade",
        "sample_size_years": 6,
        "description": "Annual frequency increased at a rate of 0.29 events/decade (not statistically significant, p=0.384)."
      }
    },
    "insights": [
      "No heatwaves detected in 2000, 2001, 2002, 2004, 2005.",
      "Most severe heatwave occurred in 2003 lasting 4 days with a peak temperature of 41.5°C."
    ]
  }
  ```

---

### 3. `GET /api/v1/analysis/heatwave/bbox`
Execute regional heatwave hazard analysis and trend regression across a geographic bounding box using deterministic spatial grid sampling ($\le 9$ sample points).

- **Query Parameters**:
  - `min_lat` (float, required, alias for `min_latitude`, range: -90.0 to 90.0): Southern latitude bound.
  - `max_lat` (float, required, alias for `max_latitude`, range: -90.0 to 90.0): Northern latitude bound ($> \text{min\_lat}$).
  - `min_lon` (float, required, alias for `min_longitude`, range: -180.0 to 180.0): Western longitude bound.
  - `max_lon` (float, required, alias for `max_longitude`, range: -180.0 to 180.0): Eastern longitude bound ($> \text{min\_lon}$).
  - `start_year` (integer, required, $\ge 1940$): Beginning analysis year.
  - `end_year` (integer, required, $\le \text{current year} - \text{lag}$): Ending analysis year.
  - `baseline_start_year` (integer, optional, default: 1991): Reference baseline start year.
  - `baseline_end_year` (integer, optional, default: 2020): Reference baseline end year.
  - `threshold_percentile` (float, optional, default: 95.0, range: 50.0–99.9): Percentile threshold.
  - `min_consecutive_days` (integer, optional, default: 3, range: 2–30): Minimum consecutive days for heatwave streak.
  - `model` (string, optional, default: "ERA5", values: "ERA5", "ERA5_LAND"): Supported reanalysis model.
- **Constraints & Rejections**:
  - Rejects inverted coordinates (`min_lat >= max_lat` or `min_lon >= max_lon`) with HTTP 422.
  - Rejects oversized bounding boxes where `(max_lat - min_lat) * (max_lon - min_lon) > 25.0` deg² ($\approx 500\text{km} \times 500\text{km}$) with HTTP 422.
- **Example Request**:
  ```http
  GET /api/v1/analysis/heatwave/bbox?min_lat=17.0&max_lat=18.0&min_lon=78.0&max_lon=79.0&start_year=2000&end_year=2005 HTTP/1.1
  Host: localhost:8000
  ```
- **Sanitized Response (200 OK)**:
  ```json
  {
    "bounding_box": {
      "min_latitude": 17.0,
      "max_latitude": 18.0,
      "min_longitude": 78.0,
      "max_longitude": 79.0,
      "area_square_degrees": 1.0
    },
    "spatial_sampling": {
      "grid_points_count": 9,
      "sample_coordinates": [
        { "latitude": 17.0, "longitude": 78.0 },
        { "latitude": 17.0, "longitude": 78.5 },
        { "latitude": 17.0, "longitude": 79.0 },
        { "latitude": 17.5, "longitude": 78.0 },
        { "latitude": 17.5, "longitude": 78.5 },
        { "latitude": 17.5, "longitude": 79.0 },
        { "latitude": 18.0, "longitude": 78.0 },
        { "latitude": 18.0, "longitude": 78.5 },
        { "latitude": 18.0, "longitude": 79.0 }
      ],
      "spatial_aggregation_method": "daily_spatial_mean",
      "min_point_coverage_ratio": 0.60,
      "spatial_completeness_percentage": 100.0,
      "disclaimer": "Regional composite metric derived from deterministic grid sampling. Not an area-wide continuous surface or point-specific measurement."
    },
    "data_source": {
      "provider": "Open-Meteo Historical Weather API",
      "dataset": "ERA5 Reanalysis",
      "variable": "temperature_2m_max",
      "unit": "°C"
    },
    "baseline": {
      "baseline_start_year": 1991,
      "baseline_end_year": 2020,
      "percentile_threshold": 95.0,
      "threshold_celsius": 39.1,
      "min_consecutive_days": 3
    },
    "analysis_window": {
      "start_year": 2000,
      "end_year": 2005,
      "total_years": 6
    },
    "data_quality": {
      "total_expected_days": 2192,
      "observed_days": 2192,
      "missing_days": 0,
      "completeness_percentage": 100.0,
      "has_critical_gaps": false,
      "longest_missing_streak_days": 0
    },
    "annual_metrics": [ ... ],
    "recent_events": [ ... ],
    "trends": {
      "annual_frequency": { ... },
      "heatwave_days": { ... },
      "cumulative_intensity": { ... }
    },
    "insights": [
      "Regional composite analysis over 1.00 deg² based on 9 sampled grid points.",
      "Most severe regional heatwave occurred in 2003 lasting 5 days."
    ]
  }
  ```

---

### 4. Health Probes
- `GET /api/v1/health/live`: Lightweight process liveness probe. Returns HTTP 200 `{"status": "alive"}`.
- `GET /api/v1/health/ready`: Deep dependency readiness probe checking MongoDB ping, Redis ping, and HTTP client readiness. Returns HTTP 200 when ready, HTTP 503 if any critical service is unavailable.

---

## 10. External Weather & Geocoding Sources

- **Open-Meteo Historical Weather API**: [https://open-meteo.com/en/docs/historical-weather-api](https://open-meteo.com/en/docs/historical-weather-api)
- **Open-Meteo Geocoding API**: [https://open-meteo.com/en/docs/geocoding-api](https://open-meteo.com/en/docs/geocoding-api)
- **ECMWF ERA5 Reanalysis**: [https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5](https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5)

---

## 11. Storage Model, Indexing & Cache Invalidation

### MongoDB Collections & Index Strategy
1. **`weather_observations`**:
   - Schema: `{ location_key: "17.3850:78.4867", date: "2003-05-18", temp_max: 41.5, unit: "°C", source_model: "ERA5", updated_at: ISO }`
   - **Unique Compound Index**: `[("location_key", 1), ("date", 1), ("source_model", 1)]` (guarantees model isolation, allowing ERA5 and ERA5-Land observations to coexist without collision).
   - **Automated Safe Migration**: On startup, `ensure_indexes()` safely drops legacy indexes lacking `source_model` (e.g. `location_key_1_date_1`) and backfills existing documents with missing `source_model` to `"ERA5"` before asserting the compound index.
2. **`baseline_thresholds`**:
   - Schema: `{ location_key: "...", baseline_start: 1991, baseline_end: 2020, percentile: 95.0, threshold_celsius: 39.4, source_model: "ERA5", updated_at: ISO }`
   - **Unique Compound Index**: `[("location_key", 1), ("baseline_start", 1), ("baseline_end", 1), ("percentile", 1), ("source_model", 1)]`.
3. **`coverage_metadata`**:
   - Schema: `{ location_key: "...", model: "ERA5", start_date: "1991-01-01", end_date: "2020-12-31", record_count: 10958, revision: 1, updated_at: ISO }`
   - **Unique Compound Index**: `[("location_key", 1), ("model", 1)]`.

### Ingestion Architecture & Calendar Date Coverage
- **Exact Calendar Gap Detection**: Compares all calendar days in the requested interval against stored observations. Missing dates are partitioned into contiguous intervals and fetched in minimal batch queries.
- **Persistent Missing Data Representation**: Distinguishes between un-fetched dates and explicitly stored missing dates (`temp_max = None`). Dates already stored with missing temperature are never re-fetched.
- **Data Publication Lag Clamping**: The ingestion boundary is strictly clamped to `today - data_lag_buffer_days` (default 5 days for ERA5). Future dates are never queried or stored.
- **Provisional Status for Current Year**: Ingested observations in the current calendar year are explicitly labeled `quality_status = "provisional"` (year-to-date) to prevent premature trend calculation.

### Deterministic Caching & Invalidation
- **Key Determinism**: Analysis responses are cached in Redis under `analysis:{lat}_{lon}:{sha256}`. The SHA-256 hash encodes coordinates, years, baseline bounds, percentile, min consecutive days, model, algorithm version, and `dataset_version`.
- **Automatic Invalidation via Revisions**: Whenever new observations are ingested, the `coverage_metadata` document increments its `revision` integer (`$inc: { revision: 1 }`). This changes the generated cache key, guaranteeing that newly ingested data immediately invalidates stale cached trend responses.

---

## 12. Scientific Heatwave & Climatological Methodology

### 1. Climatological Baseline & Percentile Threshold Definition
Because the case study requires detecting heatwaves using at least 3 consecutive days above a regional 95th-percentile temperature threshold without prescribing seasonal mechanics, the engine implements international WMO/ETCCDI climate index guidelines:

1. **Stationary Reference Baseline (1991–2020)**:
   - A standard 30-year climatological normal (`1991–2020`) is used as the reference baseline.
   - Thresholds are derived **exclusively from the reference baseline**, never from user-selected analysis years, preventing threshold drift.
2. **Calendar-Day Moving Window (±7 Days)**:
   - Rather than calculating a single static annual threshold (which would cause severe seasonal bias), the engine computes a **moving-window calendar-day threshold**.
   - For every calendar day $(m, d)$, temperatures are sampled across a $\pm 7$ calendar day centered window (15 calendar days total) across all 30 baseline years ($\approx 450$ samples per calendar day).
   - The 95th percentile is calculated via linear rank interpolation.
   - December-to-January circular wrapping and February 29 leap days are preserved deterministically.
   - **Response Semantics**: Because the threshold varies dynamically for every calendar day throughout the year, the response object returns `threshold_celsius: null` on the baseline DTO rather than presenting an arithmetic average as though it were a constant cutoff.
3. **Strict Inequality Exceedance**:
   - A day qualifies as an anomalous hot day if and only if $T_{\text{max}} > T_{95}(m, d)$. Equal temperatures are non-qualifying.

### 2. Event Detection & Year Attribution
- **Qualifying Heatwave**: Defined as **at least 3 consecutive calendar days** satisfying $T_{\text{max}} > T_{95}$.
- **Calendar Continuity**: Continuity is strictly enforced. Any missing observation (`temp_max = None`) or date gap ($> 1$ day) terminates an active streak. Missing temperatures are **never fabricated or linearly interpolated**.
- **Year Boundary Invariance & Cross-Year Accounting**:
  - **Event Frequency**: Attributed exclusively to the calendar year in which the event **originated** (inception year).
  - **Heatwave Days**: Distributed across the calendar years in which each qualifying day actually occurs (e.g., an event spanning Dec 30 to Jan 3 attributes 2 days to the first year and 3 days to the second).
  - **Exceedance Intensity**: Daily thermal exceedances above the calendar threshold are summed into the exact calendar year in which each day occurred.

### 3. Data Completeness & Quality Policy
- **Calendar-Derived Metrics**: `expected_days` is derived strictly from the Gregorian calendar (365 days, or 366 days in leap years), not from the number of returned observations.
- **Accurate Missing Streak**: `longest_missing_streak_days` tracks the maximum consecutive run of missing calendar days across the entire calendar year.
- **Outlier & Non-Finite Sanitization**: Any raw observation with non-finite values (`NaN`, `+Inf`, `-Inf`) or physical implausibility ($T_{\text{max}} < -100^\circ\text{C}$ or $T_{\text{max}} > +70^\circ\text{C}$) is flagged and sanitized to `None`.
- **Quality Status Categories**:
  - `reliable`: Completeness $\ge 90\%$ and longest consecutive missing streak $\le 15$ days.
  - `provisional`: Assigned to the current ongoing calendar year (year-to-date data).
  - `incomplete`: Usable days between $50\%$ and $90\%$, or missing streak $> 15$ days.
  - `insufficient_data`: Usable days $< 50\%$.

### 4. Trend Regression & Honest Insights
- Annual frequency, duration, and intensity trends are computed via Ordinary Least Squares (OLS) linear regression.
- **Quality Exclusion**: Only `reliable` years are included in trend regression and period comparisons; `provisional` and `incomplete` years are strictly excluded.
- **Sample Sufficiency**: Requires at least 10 reliable years for regression. When reliable years are insufficient, slope is reported as `null` rather than asserting zero events or claiming a false flat trend.
- **Numeric Slope Preservation**: When slope is truly zero, it is serialized as `0.0` rather than `null`.
- Slopes are reported with explicit units (`events/decade`, `days/decade`, `°C-days/decade`).
- Statistical significance is evaluated at $\alpha = 0.05$. Slopes with $p \ge 0.05$ are labeled as not statistically significant.
- Mathematical division protection suppresses percentage changes when early baseline frequency is zero, reporting absolute differences instead to prevent misleading mathematical artifacts.

---

## 13. Security & Performance Measures

- **Atomic Redis Rate Limiting**: Fixed-window rate limiting executed via atomic Redis Lua scripts (`INCR` + conditional `EXPIRE` + `TTL`) to prevent race conditions across parallel worker processes.
- **Client Identity Spoofing Protection**: `extract_client_identity` uses direct socket IPs by default and strictly ignores unverified `X-Forwarded-For` headers. Forwarding headers are only inspected when the direct connection originates from an explicitly configured `TRUSTED_PROXIES` address.
- **Header Propagation**: Throttled requests return standard `HTTP 429 Too Many Requests` responses including `Retry-After: <seconds>`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
- **Fail-Open Degraded Mode**: If Redis is temporarily unreachable, cache reads degrade to cache misses and rate limiting degrades to fail-open with logged warnings, ensuring transient cache downtime does not disrupt service availability.
- **Network Resiliency**: Outbound HTTP requests use bounded connection timeouts (30s) and capped exponential backoff with jitter (max 3 retries) on transient network or 5xx failures.
- **Zero Credential Leaking**: Sensitive headers, internal stack traces, and database connection secrets are suppressed from error payloads.

---

## 14. Known Limitations & Spatial Assumptions

1. **Spatial Representation of Point Queries**:
   - Open-Meteo ERA5 reanalysis data is resolved on a **$0.25^\circ \times 0.25^\circ$ grid** ($\approx 31\,\text{km} \times 31\,\text{km}$ at the equator).
   - A point coordinate query returns the representative value for the grid cell containing that coordinate. It does not resolve microclimates, urban heat islands (UHI), or localized street-canyon effects.
2. **ERA5 Publication Lag Buffer**:
   - The ECMWF ERA5 publication pipeline operates with an approximately **5-day latency**. Queries for dates within the last 5 days are rejected by input validation to prevent missing-data anomalies.
3. **Single Reanalysis Model Policy**:
   - The backend explicitly requests and validates ERA5 reanalysis data. Blending observational station data with reanalysis products is intentionally avoided to preserve baseline stationarity.

---

## 15. Future Improvements (With Additional Time)

1. **Spatial Bilinear Grid Interpolation**: Implement multi-point spatial interpolation between neighboring ERA5 grid cells to provide smooth spatial transitions across terrain boundaries.
2. **Compound Multi-Hazard Indices**: Integrate dew-point temperature and relative humidity to compute heat-index ($HI$) and wet-bulb globe temperature ($WGBT$) compound hazards.
3. **Asynchronous Background Processing Queue**: Introduce a distributed task queue (such as ARQ or Celery) with server-sent events (SSE) for bulk global multi-coordinate analyses spanning century-long datasets.
4. **Automated Baseline Precomputation**: Establish a scheduled worker to precompute baseline moving-window thresholds for major metropolitan areas.

---

## 15.1 Architectural Review of Added Complexity: Bounding Box Analysis

As part of extending the system to support custom geographic bounding box queries (`GET /api/v1/analysis/heatwave/bbox`), an architectural complexity assessment was conducted to evaluate whether the extension is worth retaining in production:

### 1. Incurred Complexity
- **Asynchronous Fan-Out**: Querying a bounding box requires concurrent ingestion across up to 9 sample points (`asyncio.gather`), increasing transient upstream HTTP connection demand.
- **Cache Key Dimensionality**: Cache key generation must digest the sorted list of sample points and a composite dataset version token, slightly increasing cache key derivation cost.
- **Missing Data Cutoff**: Daily spatial aggregation introduces a new rule: if $< 60\%$ of sampled points have valid observations on a given day, that day is treated as missing.

### 2. Architectural Mitigations & Benefits
- **Zero Schema Bleed**: Observations are persisted strictly per canonical coordinate (`location_key = "lat:lon"`), never under a shared artificial bounding box point. This allows immediate data reuse between point analyses and overlapping bounding boxes.
- **Pure Functional Composition**: Grid generation and spatial aggregation are implemented as pure, zero-dependency functions in `app/domain/grid.py` and `app/domain/spatial_aggregation.py`, reusing 100% of the existing climate engine (`run_climate_hazard_analysis`).
- **Complete Separation of Endpoints**: Adding `GET /analysis/heatwave/bbox` as an independent route guaranteed zero regression or schema contamination for the primary point endpoint `GET /analysis/heatwave`.
- **Verdict**: **Worth Retaining**. The feature adds significant value for regional spatial intelligence with minimal added code ($< 150$ LOC across domain and service layers), full test isolation (16 new tests), and zero breaking changes to existing contracts.

---

## 16. AI Tools Used Disclosure

> *Note: This section documents the AI-assisted pair-programming workflow used in developing this backend.*

- **Primary AI Assistant**: Antigravity IDE (powered by DeepMind Advanced Agentic Coding).
- **Architecture & Design**: Used for evaluating WMO/ETCCDI climate index standards, designing clean hexagonal boundaries, and formulating the multi-tier caching strategy.
- **Implementation & Testing**: Assisted in generating comprehensive unit and integration test fixtures, implementing the pure NumPy/SciPy climate engine, and formatting strict Pydantic v2 schemas.
- **Verification**: All generated mathematical algorithms, consecutive-day streak logic, and rate-limiting Lua scripts were reviewed, independently tested, and validated against live local MongoDB and Redis instances.

---

## 17. Requirement-to-File Traceability Matrix

| Requirement Dimension | Case Study Requirement | Implementation File | Verification Tests | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Data Ingestion** | Ingest weather data from public API | [OpenMeteoHistoricalWeatherClient](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/clients/open_meteo/weather.py) | [tests/test_open_meteo_clients.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/tests/test_open_meteo_clients.py) | **Complete (Mandatory)** |
| **Persistence** | Store weather data in NoSQL database | [MongoWeatherRepository](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/db/repositories.py) | [tests/test_infra_integration.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/tests/test_infra_integration.py) | **Complete (Mandatory)** |
| **Detection Engine** | Detect heatwaves ($\ge 3$ days $> 95$th percentile) | [app/domain/detector.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/domain/detector.py), [app/domain/thresholds.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/domain/thresholds.py) | `tests/test_climate_engine.py::test_detection_*` | **Complete (Mandatory)** |
| **Metrics Calculation** | Calculate frequency, duration, intensity | [app/domain/annual_metrics.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/domain/annual_metrics.py) | `tests/test_climate_engine.py::test_complete_engine_pipeline` | **Complete (Mandatory)** |
| **Trend Analysis** | Analyze trends and return JSON responses | [app/domain/trends.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/domain/trends.py), [app/api/v1/endpoints/analysis.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/api/v1/endpoints/analysis.py) | `tests/test_climate_engine.py::test_trends_*`, `tests/test_api_endpoints.py` | **Complete (Mandatory)** |
| **Bounding Box Analysis** | Regional bounding-box heatwave analysis | [app/domain/grid.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/domain/grid.py), [app/domain/spatial_aggregation.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/domain/spatial_aggregation.py), [app/services/analysis_service.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/services/analysis_service.py) | [tests/test_bounding_box_analysis.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/tests/test_bounding_box_analysis.py) | **Complete (Extension)** |
| **Resilience & Caching**| Handle missing data, API failures, caching | [app/cache/service.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/cache/service.py), [app/clients/open_meteo/weather.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/clients/open_meteo/weather.py) | [tests/test_caching_and_ratelimit.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/tests/test_caching_and_ratelimit.py) | **Complete (Mandatory)** |
| **Safe API Design** | Rate limiting, validation, health checks | [app/cache/rate_limiter.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/cache/rate_limiter.py), [app/schemas/requests.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/schemas/requests.py), [app/api/v1/endpoints/health.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/app/api/v1/endpoints/health.py) | [tests/test_health.py](file:///c:/Users/ADMIN/Desktop/pern/assesment/dygnify/backend/tests/test_health.py), `tests/test_api_endpoints.py` | **Complete (Mandatory)** |
| **Bonus Features** | Frontend interactive charts and maps | *Not implemented in backend scope* | N/A | *Deferred (Frontend)* |
| **Bonus Features** | Export to CSV / PDF | *Not implemented in backend scope* | N/A | *Deferred (Export)* |

