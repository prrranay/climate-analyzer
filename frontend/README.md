# Climate Hazard Trend Analyzer — Frontend

A high-performance, scientifically rigorous Next.js web application built with React, TypeScript, Tailwind CSS, Recharts, and Leaflet for analyzing long-term climate hazard trends from ECMWF ERA5 reanalysis data.

---

## Table of Contents

1. [Prerequisites & Setup](#prerequisites--setup)
2. [Environment Variables](#environment-variables)
3. [Development Commands](#development-commands)
4. [Backend Connection Instructions](#backend-connection-instructions)
5. [Main UI Features](#main-ui-features)
6. [Testing & Build Commands](#testing--build-commands)
7. [Deployment Instructions](#deployment-instructions)
8. [Known Limitations](#known-limitations)
9. [Case Study Requirements Checklist](#case-study-requirements-checklist)

---

## Prerequisites & Setup

- **Node.js**: `v20.x` or `v24.x` (LTS recommended)
- **Package Manager**: `npm` (v10+)
- **Running Backend**: The FastAPI backend running at `http://localhost:8000` (from `../backend`)

### Quick Setup

```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

---

## Environment Variables

The application is configured using Next.js client-safe environment variables. Never place secret API keys in `NEXT_PUBLIC_` variables.

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** | `http://localhost:8000` | Fully-qualified base URL of the FastAPI backend (no trailing slash). In production deployments, HTTPS is enforced automatically for non-local hosts. |

Example `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js local development server with Turbopack at `http://localhost:3000` |
| `npm run build` | Compiles the production build, runs TypeScript type checks, and generates static pages |
| `npm run start` | Starts the production Next.js server locally |
| `npm run lint` | Runs ESLint across all TypeScript and React source files |
| `npm test` | Runs the full Vitest unit and integration test suite |
| `npm test -- --run` | Executes tests once without watch mode |

---

## Backend Connection Instructions

The frontend communicates with the FastAPI backend through a centralized, type-safe API client (`src/lib/api.ts`).

1. **Verify Backend Health**: Ensure the backend server is running:
   ```bash
   curl http://localhost:8000/health
   # Expected response: {"status":"healthy",...}
   ```
2. **Local Port Forwarding / CORS**: The backend is configured to accept CORS requests from `http://localhost:3000`. If running the frontend on a different port or host, update the backend `ALLOWED_ORIGINS` setting.
3. **Production URL**: When deploying, set `NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com` in your production hosting environment (e.g., Vercel, Netlify, or Docker).

---

## Main UI Features

### 1. Geographic Target Selection
- **City & Region Search**: Accessible debounced autocomplete input calling `/api/v1/regions/search` with keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`). Includes quick presets (Phoenix, Madrid, New Delhi, Tokyo, Sydney, London).
- **Direct Coordinate Entry**: WGS84 latitude (`[-90.0, 90.0]`) and longitude (`[-180.0, 180.0]`) with real-time numeric validation.
- **Bounding Box Regional Analysis**: Spatial bounds (`min_lat`, `max_lat`, `min_lon`, `max_lon`) with real-time area calculation ($\le 25\text{ deg}^2$) and interactive regional presets (*Iberian Heat Corridor*, *Phoenix Metro*, *Delhi-NCR*, *Po Valley*).
- **Interactive Geographic Leaflet Map**: Client-only dynamic map with OpenStreetMap & CartoDB tiles, active rectangle bounds synchronization, interactive corner-click drawing, and non-map accessible fallback inputs.

### 2. Climatological Hazard Controls
- **Heatwave as Default**: Heatwave hazard selected by default under Release v1.0 scope.
- **Temporal Analysis Range**: Customizable period ($1940 \le \text{start} \le \text{end} \le \text{current UTC year}$, span $\le 85$ years). Defaults to WMO 1991–2020 baseline standard.
- **Advanced Parameters**: Moving-window percentile threshold (default: 95th), minimum duration ($\ge 3$ consecutive days), and model source (`ERA5` 0.25° atmosphere or `ERA5_LAND` 0.1° terrestrial).

### 3. Scientific Visualizations (Recharts)
- **Annual Event Frequency**: Time-series bar chart showing annual qualifying events with distinct SVG hatch patterns for provisional ongoing years and degraded years (not relying on color alone). Preserves genuine zero-event years vs missing data.
- **Heatwave Duration**: Dedicated single-axis bar and line chart in explicit **Days**, tracking total heatwave days and mean event duration.
- **Heatwave Intensity & Thermal Exceedance**: Clear separation of metrics to prevent misleading dual-axis representations:
  - Daily peak excess temperature above threshold (°C) and mean peak event temperature (°C).
  - Annual cumulative degree-days (°C-days) with toggleable split/stacked views.
  - Preserves nulls for zero-event years (thermal intensity is left undefined, never fabricated as 0.0°C).

### 4. Statistical Trends & Climatological Insights
- **Verbatim OLS Statistics**: Decadal slopes, annual rates, sample sizes in reliable years, and p-values directly from backend regression.
- **Zero Slope Rule**: Numeric zero slopes are formatted strictly as `0.00`, never as missing/NA.
- **Insufficient Data Explanation**: Explicitly explains when reliable historical sample size is $< 10$ years.
- **Automated Backend Insights**: High-level observations rendered directly from `data.insights`.

### 5. Expandable Methodology & Data Quality Diagnostics
- **Moving-Window Percentile Semantics**: Transparently explains that the backend evaluates moving-window percentiles centered on each calendar day across 1991–2020, avoiding seasonal bias. Null threshold is never displayed as 0°C.
- **Observation Diagnostics**: Observed vs expected days, missing day count, completeness percentage, and critical gap streak notices.

### 6. State Consistency & Parameter Synchronization
- **Parameter Modified Warning**: Alerts users when filter inputs are modified while previous analysis results are visible, preventing old results from being attributed to a newly selected region.
- **Preserved Fallback State**: Preserves last successful analysis with an explicit notice if a subsequent request fails.
- **In-Flight Cancellation**: Previous in-flight requests are automatically aborted via `AbortController` and sequence counters drop stale responses.

### 7. Scientific RFC 4180 CSV Export
- One-click export including complete metadata headers, reanalysis specifications, and annual metrics.
- Preserves missing values as empty cells (`,,,,`), safely escapes commas and quotes, and generates target-specific filenames.

---

## Testing & Build Commands

```bash
# Run the full automated test suite (6 test files, 72 tests)
npm test -- --run

# Run ESLint (zero errors, zero warnings enforced)
npm run lint

# Compile production bundle and type check
npm run build
```

---

## Deployment Instructions

### Option A: Vercel / Netlify (Recommended)
1. Link your Git repository to Vercel or Netlify.
2. Set the build command to `npm run build` and output directory to `.next`.
3. Add the environment variable:
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://api.climate-analyzer.yourdomain.com
   ```
4. Deploy. The application automatically enforces HTTPS in production for all non-localhost endpoints.

### Option B: Docker Container
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . ./
ENV NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

## Known Limitations

1. **ERA5 Reanalysis Origin (1940)**: Historical analysis cannot extend before 1940 due to upstream ECMWF ERA5 dataset boundaries.
2. **Spatial Grid Resolution**: Single-point analysis represents a 0.25° grid cell (~28 km) from ERA5 reanalysis and should not be interpreted as statewide micro-climate coverage.
3. **Bounding Box Area Limit**: Regional bounding boxes are constrained to $\le 25\text{ deg}^2$ (sampling up to 9 spatial points) to respect backend computation tolerances.
4. **Current Year Provisionality**: Metrics for the ongoing calendar year are provisional and strictly excluded from OLS decadal trend regressions.
5. **PDF Export**: PDF generation was intentionally excluded to prevent bloated client bundles; the RFC 4180 CSV export serves as the authoritative, reproducible data export format.

---

## Case Study Requirements Checklist

### Mandatory Requirements

| # | Requirement | Implementation Component | Backend API Endpoint | Verification Test | Status |
| :-: | :--- | :--- | :--- | :--- | :-: |
| 1 | **Select Supported Geographic Region** | `RegionSearch.tsx`, `CoordinateInput.tsx`, `BoundingBoxInput.tsx` | `GET /api/v1/regions/search` | `filterValidation.test.ts`, `api.test.ts` | **PASS** |
| 2 | **Heatwave Selected by Default** | `AnalysisControls.tsx` | N/A (Frontend Scope Default) | `filterValidation.test.ts` | **PASS** |
| 3 | **Selectable Analysis Period** | `AnalysisControls.tsx` | Validated in query params | `filterValidation.test.ts` | **PASS** |
| 4 | **Call Actual FastAPI Backend** | `src/lib/api.ts`, `useHeatwaveAnalysis.ts` | `GET /api/v1/analysis/heatwave`, `/bbox` | `api.test.ts`, live browser test | **PASS** |
| 5 | **Annual Frequency, Duration & Intensity Charts** | `AnnualFrequencyChart.tsx`, `HeatwaveDurationChart.tsx`, `HeatwaveIntensityChart.tsx` | Returns `annual_metrics` | `dashboardTransforms.test.ts` | **PASS** |
| 6 | **Insights from Real Backend Calculations** | `InsightsPanel.tsx` | Returns `insights` | `dashboardTransforms.test.ts` | **PASS** |
| 7 | **Honest Quality Representation (Reliable / Incomplete / Provisional)** | `DataQualityBanner.tsx`, `AnnualFrequencyChart.tsx` | Returns `quality_status`, `completeness_percentage` | `dashboardTransforms.test.ts`, `lifecycleAndStateConsistency.test.ts` | **PASS** |
| 8 | **Null Trend / Threshold Never Shown as Zero** | `BaselineMetadataCard.tsx`, `utils.ts` (`formatSlope`), `TrendSummaryPanel.tsx` | Returns nullable `threshold_celsius`, `slope_per_decade` | `dashboardTransforms.test.ts` | **PASS** |
| 9 | **Clean API Error & Empty State Handling** | `ErrorAlert.tsx`, `EmptyState.tsx`, `RecentEventsTable.tsx` | Handles `422`, `429`, `500`, network errors | `api.test.ts`, `lifecycleAndStateConsistency.test.ts` | **PASS** |
| 10 | **Responsive & Accessible Design** | `globals.css`, ARIA roles, focus rings, `sr-only` summaries | N/A (UI / UX) | Browser subagent, keyboard navigation | **PASS** |
| 11 | **Zero Hardcoded Demonstration Values** | `SummaryStats.tsx`, `page.tsx` | Strictly mapped from API responses | Code audit, `dashboardTransforms.test.ts` | **PASS** |
| 12 | **Configurable & Documented API Base URL** | `src/lib/config.ts`, `.env.example` | `NEXT_PUBLIC_API_BASE_URL` | `api.test.ts`, production build | **PASS** |
| 13 | **No Committed Secrets & Enforced HTTPS** | `.gitignore`, `src/lib/config.ts` | Enforces HTTPS in production | Git check, `config.ts` | **PASS** |
| 14 | **Independent Build & Deployment** | `package.json`, App Router static compilation | Decoupled client bundle | `npm run build` (Turbopack) | **PASS** |

### Optional Features

| Feature | Implementation Component | Backend API Endpoint | Verification Test | Status |
| :--- | :--- | :--- | :--- | :-: |
| **Feature A: Interactive Geographic Map** | `GeographicMap.tsx`, `GeographicMapClient.tsx` (Leaflet) | `GET /api/v1/analysis/heatwave/bbox` | `filterValidation.test.ts`, browser subagent | **COMPLETE** |
| **Feature B: Scientific CSV Export** | `csvExport.ts`, `ExportButton.tsx` | Serializes `HeatwaveAnalysisResponse` | `csvExport.test.ts` (11 tests) | **COMPLETE** |
