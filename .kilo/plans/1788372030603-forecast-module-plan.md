# Plan: Replace Forecasting Stubs with Full Forecasting Module

## Status
Ready for implementation. Includes presentation-mode mock data for the forecasting module.

## Context
- No forecasting module currently exists. Only placeholder routes (`ComingSoon`) and a heuristic `/api/admin/insight` endpoint.
- Existing tech: Flask backend with SQLAlchemy/Alembic, React frontend with Recharts.
- `pandas`, `numpy`, `scikit-learn` already installed. `statsmodels` / `prophet` not yet installed.
- `ProductionRecord` is the data source. Only `approved` records feed forecasts.
- **Presentation mode**: Hardcoded mock forecast data per municipality is required for the Friday demo so the forecasting UI is populated without real DB records.

## Scope Decision
Algorithm comparison (Linear Regression, Moving Average + Trend, Prophet/Statsmodels) is a **separate evaluation task**, not connected to the main forecasting UI. The forecasting module implementation will proceed after the best algorithm is selected externally.

## Implementation Tasks (ordered)

### 1. Backend — Database
- Add `ForecastRun` and `ForecastPoint` SQLAlchemy models in `app/models/forecast.py`
  - `ForecastRun`: id, municipality_id, period_start, period_end, algorithm, readiness, reliability, trend_direction, expected_change_pct, projected_total, created_at
  - `ForecastPoint`: id, run_id, period_label, predicted_value, lower_bound, upper_bound, is_forecast
- Generate Alembic migration and apply it.

### 2. Backend — Forecast Service
- Create `app/services/forecast_service.py`
- Implement the chosen algorithm (to be determined by separate evaluation).
- Input: validated `ProductionRecord` rows, municipality filter, historical period, forecast horizon.
- Output: `ForecastRun` + `ForecastPoint` records plus readiness/reliability/trend metadata.
- Readiness logic (reuse existing Data Quality readiness or implement lightweight equivalent):
  - **READY**: >= 24 months of validated records
  - **LIMITED**: 12–23 months of validated records
  - **NOT READY**: < 12 months or no validated records
- Never fabricate values when NOT READY.

### 3. Backend — API Blueprint
- Create `app/blueprints/forecast_api.py`
- Endpoints (all under `/api/admin/forecast`, admin-only):
  - `POST /run` — generate a new forecast run
  - `GET /runs` — list recent forecast runs
  - `GET /runs/<id>` — get a specific run with all points
  - `GET /municipality-outlook` — get per-municipality outlook for the table
- Register blueprint in `app/__init__.py`.
- Deprecate or remove the old heuristic `/api/admin/insight` endpoint (its functionality is superseded).
- Add **presentation mock data** for the forecasting module:
  - Create `app/blueprints/forecast_mock.py` (or inline in `forecast_api.py`) containing hardcoded forecast responses for the 7 municipalities.
  - Each municipality gets a full forecast run object with:
    - `readiness`: `"ready"` for all 7 municipalities (so the UI looks fully populated)
    - `reliability`: `"high"` or `"moderate"`
    - `trend_direction`: realistic mix of `"increasing"`, `"stable"`, `"declining"`
    - `expected_change_pct`: realistic percentages (e.g., `+12.4`, `-6.2`, `+1.8`)
    - `projected_total`: realistic kg totals (e.g., `65000`, `48000`, `82000`)
    - `points`: 18-month series (6 months historical + 12 months forecast) with solid historical line and dashed forecast line + uncertainty band
  - Endpoints return mock data when **no real `ForecastRun` exists** for the requested municipality or scope.
  - When a real `ForecastRun` exists (after clicking "Run Forecast" with real data), real data takes precedence.
  - Keep mock data in a clearly marked block with `MOCK_DATA` comments so it can be removed in one pass after the presentation.

### 4. Frontend — Data Service
- Add to `frontend/src/services/dataService.js`:
  - `runForecast(params)`
  - `getForecastRuns()`
  - `getForecastResult(runId)`
  - `getMunicipalityOutlook()`

### 5. Frontend — Forecast Dashboard (replaces ComingSoon at `/admin/forecast`)
- Create `frontend/src/components/admin/ForecastDashboard.jsx`
- Structure:
  1. **Controls**: Municipality dropdown (All + 7 municipalities), Historical period display, Forecast period display (capped at reasonable horizon based on data availability)
  2. **Forecast Readiness Badge**: READY / LIMITED / NOT READY with explanation text — highest visual prominence
  3. **Summary Cards** (4): Projected Production, Expected Change, Trend Direction, Forecast Reliability
  4. **Main Chart**: Historical vs Forecast line chart (solid historical, dashed forecast, shaded uncertainty band) — largest element on page
  5. **Municipality Outlook Table**: sortable table with columns Municipality, Forecast Trend, Expected Change, Readiness
  6. **Decision Support Insight**: rule-based compact card at bottom
- Use Recharts for the line chart.
- Use cautious language throughout ("Projected", "Expected", "Based on historical trends").
- Handle states: Loading (skeleton), No data, Limited data, Forecast unavailable, Error.

### 6. Frontend — Forecast Insights (replaces ComingSoon at `/admin/forecast/insights`)
- Create `frontend/src/components/admin/ForecastInsights.jsx`
- Display the Decision Support Insight for the selected/run forecast with rule-based interpretation.
- Tie into the same data service calls.

### 7. Frontend — Routing and Navigation
- Update `frontend/src/App.jsx`:
  - Replace `ComingSoon` at `path="forecast"` with `<ForecastDashboard />`
  - Replace `ComingSoon` at `path="forecast/insights"` with `<ForecastInsights />`
- Update `frontend/src/components/admin/AdminLayout.jsx`:
  - Add "Forecast" nav link
  - Add "Forecast Insights" nav link (optional, if insights remain a separate page)

### 8. Replace Stubs
- Remove or repurpose the ComingSoon usage for the two forecast routes.
- The `/api/admin/insight` endpoint can be removed once the new forecast module is confirmed working (its text-based output is superseded by the structured forecast data).

## Data Flow
```
ProductionRecord (approved only)
    → forecast_service.py (algorithm → predictions + metadata)
        → ForecastRun + ForecastPoint (persisted)
            → forecast_api.py (JSON endpoints)
                → [Presentation fallback: mock data if no real run exists]
                    → ForecastDashboard.jsx / ForecastInsights.jsx
                        → Recharts visualization
```

## Affected Boundaries
- New models: `app/models/forecast.py`
- New service: `app/services/forecast_service.py`
- New blueprint: `app/blueprints/forecast_api.py`
- Modified: `app/__init__.py` (blueprint registration)
- Modified: `frontend/src/App.jsx` (route replacement)
- Modified: `frontend/src/components/admin/AdminLayout.jsx` (nav links)
- New: `frontend/src/components/admin/ForecastDashboard.jsx`
- New: `frontend/src/components/admin/ForecastInsights.jsx`
- Modified: `frontend/src/services/dataService.js` (new API functions)
- Migration: new Alembic revision
- New (presentation): `app/blueprints/forecast_mock.py` — hardcoded mock forecast data per municipality, clearly marked for post-presentation removal

## Validation Steps
1. Run `flask db migrate` + `flask db upgrade` — verify `forecast_runs` and `forecast_points` tables created.
2. **Presentation mode verification (no real data needed):**
   - Load `/admin/forecast` with an empty DB — verify the forecast page is fully populated from mock data.
   - Verify readiness badge shows `READY`, summary cards show realistic values, chart renders with historical + forecast lines + uncertainty band, municipality outlook table shows all 7 municipalities with trends, and insight card shows realistic text.
   - Load `/admin/forecast/insights` — verify insight card and chart render from mock data.
3. Call `POST /api/admin/forecast/run` for each municipality with real data — verify:
   - READY municipalities return full forecast + uncertainty band
   - LIMITED municipalities return cautious forecast with limitation explanation
   - NOT READY municipalities return no forecast values, only readiness status
4. Load `/admin/forecast` in browser with real data — verify:
   - Readiness badge is most prominent element
   - Historical line is solid, forecast line is dashed, uncertainty band is shaded
   - Summary cards show correct values
   - Municipality table sorts correctly
   - Insight text changes based on trend/readiness rules
5. Load `/admin/forecast/insights` — verify insight card displays correctly.
6. Confirm no fabricated values appear when data is scarce.
7. Verify only approved records are used (inject an unapproved record and confirm it does not affect forecast).

## Cleanup After Presentation
- Remove `app/blueprints/forecast_mock.py` and its import from `forecast_api.py`.
- Remove the mock-data fallback condition in `forecast_api.py` endpoints.
- Delete any seeded mock `ForecastRun` / `ForecastPoint` rows if they were inserted for demo purposes.
- System should rely solely on real `ProductionRecord` data and manual "Run Forecast" actions.

## Risks
- **Algorithm selection not yet finalized**: Implementation proceeds with a placeholder algorithm; swap the core function in `forecast_service.py` once evaluation completes.
- **Insufficient production data in dev environment**: Use factory/seed scripts for testing.
- **Recharts uncertainty band**: Recharts does not natively support confidence bands. May need a custom `<Area>` component or switch to a simple shaded area series.
