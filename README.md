# Climate Hazard Trend Analyzer

A full-stack application for exploring historical heatwave frequency, duration, intensity, and long-term trends for a selected geographic location or bounding box. The application uses historical weather reanalysis data, a documented percentile-based heatwave definition, quality-aware trend analysis, and interactive visualizations.

## Live Demo

- **Frontend:** https://dygnify-climate-analyzer.vercel.app
- **Backend service:** https://climate-analyzer-backend.onrender.com
- **Backend liveness:** https://climate-analyzer-backend.onrender.com/api/v1/health/live
- **Backend readiness:** https://climate-analyzer-backend.onrender.com/api/v1/health/ready

The backend's interactive OpenAPI/Swagger documentation is enabled for local non-production environments at `http://localhost:8000/docs`. It is disabled when `ENVIRONMENT=production` in the current configuration.

## Features

- Search for cities/regions using geocoding, or enter latitude/longitude directly.
- Analyze a custom geographic bounding box using a deterministic sample grid.
- Heatwave analysis selected by default.
- Select analysis years, percentile, minimum consecutive-day duration, and supported reanalysis model.
- Interactive charts for annual event frequency, heatwave days/duration, temperature exceedance, and cumulative heat burden.
- Annual quality indicators that distinguish reliable, incomplete, insufficient, and provisional data.
- Trend summaries and text insights generated from backend metrics.
- Recent-event table, methodology/data-quality details, and CSV export.
- MongoDB persistence for normalized daily observations and Redis caching/rate limiting.

The current scope focuses on heatwaves. Cold spells and drought are shown as future/unsupported UI scopes and are not implemented as analysis endpoints.

## Technology Stack

| Layer | Technologies | Responsibility |
|---|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS | Filter controls, dashboard, responsive UI, API integration |
| Charts | Recharts | Interactive time-series and metric visualizations |
| Map | Leaflet | Bounding-box region selection |
| Backend | Python 3.12+, FastAPI, Pydantic v2 | Validated REST API and application orchestration |
| Climate analysis | NumPy, SciPy and typed Python domain modules | Percentile thresholds, event detection, annual metrics and OLS trends |
| Persistence | MongoDB with PyMongo Async | Daily observation storage, coverage metadata and dataset revisions |
| Cache / rate limiting | Redis with `redis-py` asyncio | Analysis response caching and shared rate limiting |
| External APIs | Open-Meteo Historical Weather API and Geocoding API | Historical daily maximum temperature and geographic search |

## Architecture

```text
Browser
  └── Next.js UI (filters, charts, map, CSV export)
        └── Typed API client (HTTP / JSON)
              └── FastAPI v1 routes
                    ├── Region service ── Open-Meteo Geocoding API
                    └── Analysis service
                          ├── Weather ingestion service ── Open-Meteo Historical Weather API
                          ├── Pure climate domain engine
                          │     ├── Calendar-day percentile thresholds
                          │     ├── Consecutive-day event detection
                          │     ├── Annual metrics and quality checks
                          │     └── OLS trend calculations and insights
                          ├── MongoDB repositories
                          └── Redis cache and rate limiter
```

The API routes are kept thin. Provider-specific parsing, persistence, application orchestration, and pure climate calculations are separated so the analysis logic can be tested without requiring a live API or database.

## Data Source and Storage

### Data sources

- [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) supplies daily maximum near-surface air temperature (`temperature_2m_max`).
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) resolves text searches to geographic candidates and coordinates.
- The default data model is **ERA5 Reanalysis**. The backend also accepts `ERA5_LAND` as a model selection. Different models are stored and retrieved separately and are not intended to be silently mixed.

### Storage and caching

- **MongoDB** stores normalized daily observations, including location key, date, source model, temperature value, and coverage/version metadata. A compound observation identity includes location, date, and model so ERA5 and ERA5-Land observations can coexist.
- Missing temperature values are represented explicitly. A recorded missing measurement is distinguished from a date that has never been ingested.
- **Redis** stores computed analysis responses with deterministic keys that include the analysis inputs, algorithm version, model, and dataset revision. Redis is also used for shared rate limiting.
- Ingestion checks calendar-date coverage and requests missing date ranges rather than intentionally refetching every stored observation.

## Climate Methodology and Assumptions

The climate rules are deliberately explicit so the resulting metrics can be explained and tested.

### Heatwave definition

A heatwave is a run of at least **three consecutive calendar days** where daily maximum temperature is **strictly greater than** the relevant calendar-day temperature threshold. The minimum duration is configurable through the API.

### Reference baseline and percentile threshold

- Default reference baseline: **1991–2020**.
- Default percentile: **95th percentile**.
- The backend computes a calendar-day moving-window percentile using a **±7-day window** around each calendar day across the reference baseline. This makes the threshold seasonally varying rather than one constant value for the entire year.
- The baseline is fixed independently of the selected analysis period, so changing the analysis years does not redefine the threshold.
- Since the threshold changes by calendar day, the response's `baseline.threshold_celsius` is `null` for this moving-window method. This must not be interpreted as `0°C`.
- A temperature equal to the threshold does not qualify as an exceedance.

### Events and annual attribution

- Event frequency is assigned to the calendar year in which the event starts.
- Heatwave days and daily exceedance intensity are assigned to the calendar year in which those days occur. For example, an event spanning December and January contributes event frequency to its start year, but its heatwave days are split across both years.
- Missing measurements and missing calendar dates break a consecutive-day streak. The system does not interpolate missing temperatures to manufacture heatwave events.

### Data quality

- Expected days are derived from the calendar, including leap years.
- Non-finite temperatures (`NaN`, `+Inf`, `-Inf`) and values outside the configured plausibility range `[-100°C, 70°C]` are sanitized to missing values rather than clipped into plausible-looking values.
- Completeness and longest missing streak are tracked and surfaced in the response/UI.
- The current calendar year is treated as **provisional/year-to-date**.
- Per the current backend policy, reliable years require at least 90% completeness and no missing streak longer than 15 days. Provisional and unreliable years are excluded from trend regression and period comparisons.
- Trends require at least 10 eligible reliable years. If there is insufficient reliable data, the slope is reported as unavailable (`null`) rather than fabricated as zero.

### Trend interpretation

The backend uses ordinary least squares (OLS) regression for annual metrics and reports slopes with units such as events/decade, days/decade, or °C-days/decade. It also returns p-values and significance information where supported by sufficient data. The default significance threshold is `p < 0.05`.

A statistical trend is an association in the selected dataset and period; it is not, by itself, proof of causation or attribution to climate change. Percentage-change insights are avoided when a zero baseline would make the percentage misleading.

### Bounding-box analysis

For a custom bounding box, the backend generates a deterministic spatial grid with up to nine sample points, subject to validation limits. It aggregates observations spatially using the documented daily mean and a minimum valid-point coverage rule. A point or coarse reanalysis grid is not a street-level or high-resolution urban heat model; spatial averages can also hide localized extremes.

### Timezone assumption

The current weather adapter requests daily aggregates with `timezone=UTC`. The selected location's timezone may be returned as metadata, but it does not change those upstream daily boundaries. Interpret the current results as UTC-based daily aggregates unless the adapter is changed to use a consistently configured local-day convention. Any future timezone behavior change should be accompanied by re-ingestion/versioning so stored daily data are not mixed across different day boundaries.

## Local Development Setup

### Prerequisites

- Python 3.12 or newer
- Node.js compatible with the installed Next.js version (Node.js 20.9+ recommended)
- npm
- Docker Desktop or local MongoDB and Redis services

### 1. Start MongoDB and Redis

From the repository root:

```bash
cd backend
docker compose up -d mongodb redis
docker compose ps
```

The local Compose services expose MongoDB on `localhost:27017` and Redis on `localhost:6379`.

### 2. Configure and run the backend

**Windows PowerShell:**

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".[dev]"
Copy-Item .env.example .env
```

**macOS/Linux:**

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
cp .env.example .env
```

After copying the file, check `backend/.env` and set local service URLs to:

```env
ENVIRONMENT=development
DEBUG=true
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=climate_hazards
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=["http://localhost:3000"]
```

Keep your private production connection strings out of source control. `.env` files are ignored by Git.

Start the API from the `backend` directory:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Useful local URLs:

- API root: http://localhost:8000/
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Liveness: http://localhost:8000/api/v1/health/live
- Readiness: http://localhost:8000/api/v1/health/ready

### 3. Configure and run the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm install --legacy-peer-deps
```

Create `frontend/.env.local` from the provided example:

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS/Linux
cp .env.example .env.local
```

The local value should be:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Then run:

```bash
npm run dev
```

Open http://localhost:3000. The frontend API base URL is a public build-time setting; never put credentials or private API keys in `NEXT_PUBLIC_` variables.

## API Overview

All endpoints are versioned under `/api/v1`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/regions/search?q=Hyderabad&count=5` | Search geographic locations |
| `GET` | `/api/v1/analysis/heatwave` | Analyze a point location and calculate annual metrics/trends |
| `GET` | `/api/v1/analysis/heatwave/bbox` | Analyze a geographic bounding box |
| `GET` | `/api/v1/health/live` | Check that the API process is alive |
| `GET` | `/api/v1/health/ready` | Check required MongoDB and Redis connectivity |

### Example: search for a region

```bash
curl "http://localhost:8000/api/v1/regions/search?q=Hyderabad&count=5"
```

### Example: point analysis

```bash
curl "http://localhost:8000/api/v1/analysis/heatwave?latitude=17.385&longitude=78.487&start_year=1991&end_year=2020&threshold_percentile=95&min_consecutive_days=3&model=ERA5"
```

### Example: bounding-box analysis

```bash
curl "http://localhost:8000/api/v1/analysis/heatwave/bbox?min_lat=32.5&max_lat=34.5&min_lon=-113&max_lon=-111&start_year=1991&end_year=2020&threshold_percentile=95&min_consecutive_days=3&model=ERA5"
```

The API response contains location/region metadata, source/model information, baseline methodology, the analysis window, data-quality statistics, annual metrics, recent events, trend results, and backend-generated insights. See local Swagger for the current full schema.

## Configuration Reference

Backend settings are loaded from `backend/.env` or environment variables. Important settings include:

| Variable | Purpose |
|---|---|
| `ENVIRONMENT`, `DEBUG` | Runtime environment and debug behavior |
| `MONGODB_URI`, `MONGODB_DB_NAME` | MongoDB connection and database |
| `REDIS_URL` | Redis connection |
| `OPEN_METEO_HISTORICAL_API_URL`, `OPEN_METEO_GEOCODING_API_URL` | External provider endpoints |
| `BASELINE_START_YEAR`, `BASELINE_END_YEAR` | Default reference baseline |
| `MIN_ANALYSIS_YEAR`, `MAX_ANALYSIS_RANGE_YEARS` | Analysis time-range limits |
| `DATA_LAG_BUFFER_DAYS` | Avoids requesting very recent, potentially unpublished reanalysis data |
| `MAX_BBOX_AREA_SQ_DEGREES`, `MAX_BBOX_SAMPLE_POINTS` | Spatial query guardrails |
| `RATE_LIMIT_ENABLED`, `RATE_LIMIT_ANALYSIS_RPM`, `RATE_LIMIT_REGIONS_RPM` | Redis-backed request limits |
| `CACHE_TTL_SECONDS`, `ANALYSIS_ALGORITHM_VERSION` | Cache expiry and calculation-version invalidation |
| `CORS_ORIGINS`, `TRUSTED_PROXIES` | Allowed web origins and explicitly trusted reverse proxies |

See `backend/.env.example` for the complete settings list. If running locally, ensure `CORS_ORIGINS` includes `http://localhost:3000`. For deployment, include the exact frontend origin.

## Tests and Quality Checks

Run commands from the relevant application directory.

### Backend

```bash
cd backend
pytest -v
pytest --cov=app --cov-report=term-missing
ruff check app tests
ruff format --check app tests
```

The full integration path requires MongoDB and Redis. The tests use mocked providers where appropriate; run the entire suite in an environment with the project's development dependencies installed.

### Frontend

```bash
cd frontend
npm test
npm run lint
npm run build
```

Do not treat a test suite as passed if it could not run because of missing dependencies or unavailable infrastructure.

## Deployment

- **Frontend:** https://dygnify-climate-analyzer.vercel.app
- **Backend:** https://climate-analyzer-backend.onrender.com

For a new deployment:

1. Configure `NEXT_PUBLIC_API_BASE_URL` in the frontend hosting environment as the HTTPS backend URL, then redeploy the frontend. Next.js public environment variables are embedded at build time.
2. Configure the backend's `MONGODB_URI`, `MONGODB_DB_NAME`, and `REDIS_URL` using managed services. Do not use the local Docker service hostnames for a remotely deployed API.
3. Set `ENVIRONMENT=production` and `DEBUG=false` for the deployed backend.
4. Set `CORS_ORIGINS` to the exact deployed frontend origin, for example `https://dygnify-climate-analyzer.vercel.app`.
5. Verify the liveness and readiness endpoints after deployment, then run a real point analysis and a bounding-box analysis from the frontend.
6. Keep all secrets in the hosting provider's server-side environment settings. Do not commit `.env` files or put database/Redis credentials in frontend variables.

## Known Limitations

- The current implemented hazard is heatwave. Other hazard cards are not active analysis capabilities.
- A point query reflects the reanalysis grid-cell data associated with that coordinate; it is not street-level measurement and cannot resolve all local microclimates.
- Bounding-box analysis samples a limited number of points and uses a spatial aggregation rule; it should not be interpreted as a high-resolution model of every location in the selected area.
- Current-year values are provisional because the year is incomplete and recent reanalysis data may not yet be available.
- The current adapter requests UTC-based daily aggregates; location-local calendar-day boundaries are not currently applied to the upstream daily request.
- OLS trend estimates depend on data availability, selected baseline, heatwave definition, and spatial choice. They indicate statistical patterns, not causal attribution.
- PDF export and the Mann–Kendall trend test are not implemented. CSV export and OLS regression are included.

## What I Would Improve With More Time

- Reconcile the daily aggregation timezone with the intended local-calendar-day interpretation and safely version/re-ingest data if this changes.
- Optimize the analysis cache-hit path so a valid cached response can be returned without loading the entire daily observation series.
- Expand end-to-end tests against deployed MongoDB/Redis and exercise upstream API failure/recovery scenarios.
- Add alternative trend tests such as Mann–Kendall and provide uncertainty intervals where appropriate.
- Improve bounding-box spatial methods and make sampling/resolution trade-offs easier to compare.
- Add background jobs for long-running or repeated analyses and more explicit ingestion observability.

## AI Tools Used

- **ChatGPT (OpenAI):** used for architecture discussions, implementation prompt planning, review checklists, and documentation drafting.
- **Antigravity IDE / its AI coding assistant:** used to assist with code generation and refinement during implementation. Update this wording if a different IDE/tool/model was used for any part of the submitted code.

AI assistance was used as a development aid. The implementation, assumptions, test results and scientific interpretation should be reviewed and understood by the author, especially because the submitted code may be discussed and modified during an interview.

