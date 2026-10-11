# Climate Hazard Trend Analyzer — Frontend

A modern Next.js web application built with React, TypeScript, Tailwind CSS, and Recharts for analyzing long-term climate hazard trends from ECMWF ERA5 reanalysis data.

---

## Features

- **Global & Regional Hazard Selection**:
  - **Single Point / City Search**: Debounced city autocomplete using backend geocoding (`/api/v1/regions/search`), with curated global heat vulnerability hotspots (Phoenix, Madrid, New Delhi, Tokyo, Sydney, London).
  - **Bounding Box Regional Mode**: Define spatial bounds (`min_lat`, `max_lat`, `min_lon`, `max_lon`) with real-time area calculation and backend constraint enforcement (area ≤ 25 deg²).
- **Hazard Support**: Heatwave analysis (active) with extensible architecture for Cold Spells and Droughts.
- **Customizable Climatology Parameters**:
  - User-selectable analysis period (start year ≥ 1940 to current UTC year; span ≤ 85 years).
  - Reference baseline period (default: WMO 1991–2020 standard).
  - DOY moving-window percentile threshold (default: 95th percentile).
  - Minimum consecutive duration (default: 3 days).
  - Reanalysis dataset selection: `ERA5` (0.25° global atmosphere) or `ERA5_LAND` (0.1° terrestrial).
- **Interactive Visualizations (Recharts)**:
  - **Annual Frequency & Duration Chart**: Dual-axis bar and line chart visualizing annual heatwave events and cumulative extreme days per year.
  - **Intensity & Cumulative Heat Burden Chart**: Tracks peak recorded temperatures (°C) and cumulative exceedance degree-days (°C-days) over time.
- **Statistical Trend Detection (OLS Linear Regression)**:
  - Displays decadal slopes, annual rates, sample sizes, and p-values for frequency, duration, and cumulative heat burden.
  - Color-coded badges indicating statistical significance ($p < 0.05$) and trend direction (increasing, decreasing, stable, indeterminate).
- **Data Quality & Uncertainty Indicators**:
  - Observation completeness percentage bar.
  - Observation gap streak tracking and critical gap alerts (triggered if completeness < 90% or missing streak > 15 days).
  - **Provisional Year Awareness**: Explicit indicator when the ongoing calendar year is included, noting that provisional metrics are excluded from statistical trend regression.
- **Automated Climatological Insights**: Renders high-level key takeaways generated directly by the backend algorithm.
- **Recent Extreme Events Log**: Detailed table of the last 10 historical heatwave anomalies.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## Getting Started

### 1. Prerequisites

- Node.js 18.17+ or 20+
- The FastAPI backend running at `http://localhost:8000` (from `../backend`)

### 2. Install Dependencies

```bash
cd frontend
npm install
```

### 3. Environment Configuration

Create a `.env.local` file (copy from `.env.example`):

```bash
cp .env.example .env.local
```

Configure the backend URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production

```bash
npm run build
npm run start
```

---

## Directory Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout with fonts, metadata, and dark theme
│   │   ├── page.tsx                  # Main analysis and dashboard page
│   │   └── globals.css               # Tailwind CSS v4 design system
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx            # Header with live API heartbeat badge
│   │   │   └── Footer.tsx            # Attribution & backend documentation link
│   │   ├── filters/
│   │   │   ├── RegionSearch.tsx       # Debounced city geocoding & presets
│   │   │   ├── BoundingBoxInput.tsx   # Regional bounding box with area validation
│   │   │   └── AnalysisControls.tsx   # Climatology controls & advanced accordion
│   │   ├── dashboard/
│   │   │   ├── SummaryStats.tsx       # Key metrics tiles (total events, rates, max temp)
│   │   │   ├── DataQualityBanner.tsx  # Completeness bar & provisional indicators
│   │   │   ├── TrendSummaryPanel.tsx  # OLS regression slopes, p-values, direction
│   │   │   ├── InsightsPanel.tsx      # Backend synthesized insights
│   │   │   ├── RecentEventsTable.tsx  # Table of recent heatwave occurrences
│   │   │   └── BaselineMetadataCard.tsx # ERA5 dataset & grid sampling metadata
│   │   ├── charts/
│   │   │   ├── FrequencyDurationChart.tsx # Recharts frequency & duration time-series
│   │   │   └── IntensityTrendsChart.tsx   # Recharts intensity & degree-days area chart
│   │   └── ui/
│   │       ├── Card.tsx               # Glassmorphic card primitive
│   │       ├── Badge.tsx              # Status badge primitive
│   │       ├── LoadingSpinner.tsx     # Loading animation
│   │       ├── ErrorAlert.tsx         # Backend error & validation issues display
│   │       └── EmptyState.tsx         # Guidance empty state with quick example
│   ├── hooks/
│   │   ├── useRegionSearch.ts         # Search hook with debounce & AbortController
│   │   └── useHeatwaveAnalysis.ts     # Analysis query hook for point & bbox
│   ├── lib/
│   │   ├── api.ts                     # Typed fetch client with ApiError handling
│   │   ├── config.ts                  # Runtime environment config & validation
│   │   ├── constants.ts               # Hazard presets, cities, default parameters
│   │   └── utils.ts                   # Formatters, quality badges, trend helpers
│   └── types/
│       └── api.ts                     # Exact Pydantic mirror TypeScript interfaces
└── package.json
```
