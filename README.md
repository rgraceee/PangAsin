# PangAsin

Salt production monitoring, forecasting, and decision support system for the ASIN Center (Pangasinan State University, DOST NICER Program).

The system runs as a **single Flask server** on port **5000**. Flask serves the pre-built React dashboard (in `app/static/react/`) directly, so no Vite dev server is needed to run the app.

## Setup

1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and configure your database URL:
   ```bash
   copy .env.example .env
   ```

3. Apply the database migrations:
   ```bash
   set FLASK_APP=run.py
   flask db upgrade
   ```
   > Note: when pointing at an existing Supabase database, the schema is
   > already present, so migrations are typically already applied. The app
   > connects to the database via the `DATABASE_URL` in `.env`.

4. Start the server:
   ```bash
   python run.py
   ```
   The app runs at http://localhost:5000.

## Access the app

- **Public dashboard:** http://localhost:5000/public-dashboard
- **Encoder login:** http://localhost:5000/public-dashboard#/login
- **Admin login:** http://localhost:5000/public-dashboard#/login

## Demo Accounts

User accounts live in the database. They follow the pattern `admin@pangasin.gov.ph` for the administrator and `{municipality}.encoder@pangasin.gov.ph` for each municipality's encoder.

| Role | Email | Password |
|---|---|---|
| Administrator | admin@pangasin.gov.ph | admin123 |
| Encoder (Alaminos) | alaminos.encoder@pangasin.gov.ph | encoder123 |
| Encoder (Bolinao) | bolinao.encoder@pangasin.gov.ph | encoder123 |

## Municipality Management (Admin)

Admins add and maintain municipalities from **Admin → Municipalities**. The database is the source of truth; the app no longer assumes a fixed list of seven municipalities.

- **Add Municipality** requires a name, latitude, and longitude. Barangays are optional (up to 100 per municipality), so a municipality can be created with zero barangays and no production data. Coordinates can be typed or picked on the embedded map.
- An encoder account is created automatically:
  - Email: `{slug}.encoder@pangasin.gov.ph`.
  - Display name: `Encoder - {Municipality Name}`.
  - Slug rules: lowercase, drop a leading `City of ` and a trailing ` City`, then remove non-alphanumeric characters (`Alaminos City` → `alaminos`, `San Fabian` → `sanfabian`).
  - If an active encoder already exists for the municipality, no second account is created.
  - If the email is already in use, the request fails with `409`; accounts are never auto-suffixed.
- The generated temporary password is shown **once** in the admin UI. The encoder must replace it on first sign-in; every other API stays blocked until `must_change_password` is cleared.
- Municipality names and user emails are unique case-insensitively. Barangays are unique per municipality, also case-insensitively.
- **Seed Pangasinan** adds every Pangasinan municipality that is still missing from the database. Seeded municipalities have no barangays or production records but receive the usual encoder account and one-time password.
- Barangays can be added, renamed, and deleted from the edit dialog. Deletion is blocked while production records, environment reports, producers, producer-report entries, or generated reports still reference the barangay.
- Renaming a municipality does not change the encoder email or display name. Deactivating a municipality hides it from public, analytics, forecast, and data-quality views and deactivates its active encoder accounts. Reactivating does not automatically reactivate encoders.
- **Boundary upload:** admins can upload a GeoJSON `Polygon`/`MultiPolygon` (up to 5 MB) for a municipality. Files are validated and stored as `app/static/geojson/{slug}.json`; the edit dialog can also remove the uploaded file. Municipalities without an uploaded or bundled match fall back to a latitude/longitude marker.
- **Hard delete:** deleting a municipality requires typing its name. If production data exists, a second explicit confirmation is required; the delete then removes the municipality, its barangays, encoder accounts, production records, reports, forecasts, producers, and related rows.
- **Audit log:** every municipality, barangay, account, boundary, and sign-in change is recorded under **Admin → Audit Log**. The trail stores the actor, action, entity, summary, IP address, and timestamp.
- **Rate limiting:** sign-in attempts are limited per IP + email and admin write requests per user. Exceeding a limit returns `429` with a `Retry-After` header. Limits are configurable with `LOGIN_RATE_LIMIT`, `LOGIN_RATE_WINDOW`, `ADMIN_WRITE_RATE_LIMIT`, and `ADMIN_WRITE_RATE_WINDOW`; set `RATE_LIMIT_ENABLED=0` to disable the limiter.

Apply the migration before using the page:

```bash
flask db upgrade
```

## Project Structure

```
pangasin/
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── extensions.py
│   ├── models/
│   ├── forms/
│   ├── blueprints/
│   ├── services/
│   ├── templates/
│   ├── static/
│   │   └── react/       # production frontend build output
├── frontend/            # React dashboard source (optional; rebuild only)
├── migrations/
├── requirements.txt
├── .env.example
└── run.py
```

## Rebuilding the frontend (only after code changes)

The running app uses the pre-built bundle in `app/static/react/`. The React source lives in `frontend/`; to rebuild after changing it:

```bash
cd frontend
npm install
npm run build
```

`npm run build` outputs fresh assets to `app/static/react/`, which Flask serves automatically. No dev server is required to view the app.

## Tests

The backend tests use an isolated SQLite database, so they never touch your configured database:

```bash
pip install -r requirements-dev.txt
python -m pytest
```

## Notes

- Python 3.11+ is recommended. The frontend was built with Node 18+ if you need to rebuild it.
- The app runs on a **single server** (`python run.py`) — no Vite/Node dev server is needed to view the system.
- React frontend is pre-built in `app/static/react/` and served by Flask; Bootstrap is bundled in that build.
- `statsmodels` is optional: if it is not installed, SARIMAX is skipped as a forecast candidate and the app falls back to the other models (`pip install statsmodels`).

## Glossary

One term = one meaning, everywhere (UI, API fields, code). Definitions live in
`app/labels.py` (backend) and `frontend/src/constants/labels.js` (frontend).

| Term | Code name | Unit | Meaning |
|------|-----------|------|---------|
| Recorded production | `recorded_mt` / `recordedMt` | MT | Total approved production volume, from validated records only. |
| Forecast production | `forecast_mt` / `forecastMt` | MT | Model-predicted production volume for a future month. |
| Forecast production total | `forecast_total_mt` / `forecastTotalMt` | MT | Sum of monthly forecast volumes over the selected horizon. |
| Local production (benchmark) | `local_production_mt` / `localProductionMt` | MT | Benchmark figure for local salt production from the demand benchmark table. |
| Salt demand | `demand_mt` / `demandMt` | MT | Annual salt demand benchmark from the provincial demand benchmark. |
| Demand shortfall | `demand_shortfall_mt` / `demandShortfallMt` | MT | Forecast production minus salt demand (negative = surplus). |
| Recorded coverage | `recorded_coverage_pct` / `recordedCoveragePct` | % | Approved recorded production / salt demand (active municipalities with recorded data). |
| Share of local production | `recorded_share_of_local_pct` / `recordedShareOfLocalPct` | % | Recorded production / local production benchmark. |
| Import share of demand | `import_share_pct` / `importSharePct` | % | Import volume / salt demand. |
| Production target | `production_target_mt` / `productionTargetMt` | MT | Monthly or annual production goal set by the user. |
| Data sufficiency | `data_sufficiency` / `dataSufficiency` | — | Sufficient / Limited / Insufficient history to forecast. |
| Forecast confidence | `forecast_confidence` / `forecastConfidence` | — | High / Moderate / Low; combines data amount and past accuracy, not a statistical confidence level. |
| Forecast method | `forecast_method` / `forecastMethod` | — | Linear Regression, Random Forest, ARIMA, SARIMAX, Seasonal baseline, or Not forecast. |
| Expected range (90%) | `range_low_mt` / `range_high_mt` | MT | Lower / upper bound of the 90% expected range for forecast production. |
| Direction | `trend_direction` / `trendDirection` | — | Increasing / Stable / Declining. |
| Change vs recent average | `change_vs_recent_avg_pct` / `changeVsRecentAvgPct` | % | Percentage change of forecast versus the recent historical average. |
| Incomplete recent months | `partial_reporting_tail` / `partialReportingTail` | — | The latest year is under-reported relative to the latest complete year. |
| Accuracy check | `backtest` | — | Holdout comparison of actual vs predicted for the chosen model. |
| Average error | `mae_mt` / `maeMt` | MT | Mean Absolute Error of the chosen model. |
| Typical error | `rmse_mt` / `rmseMt` | MT | Root Mean Square Error of the chosen model. |
| Average error (%) | `mape_pct` / `mapePct` | % | Mean Absolute Percentage Error of the chosen model. |
| Seasonal pattern | `seasonal_pattern` / `seasonalPattern` | — | Average production by calendar month (replaces heatmap). |
| Municipality forecast summary | `municipality_forecast_summary` / `municipalityForecastSummary` | — | Per-municipality forecast volumes and method (replaces outlook). |
| Yield per salt bed | `yield_per_bed_mt` / `yieldPerBedMt` | MT per bed | Recorded production / number of salt beds. |
| Yield per hectare | `yield_per_ha_mt` / `yieldPerHaMt` | MT per hectare | Recorded production / total production area (m² → ha). `area_per_salt_bed` is stored in m². |
| Reporting completeness | `reporting_grid` / `reportingGrid` | — | Which months each municipality reported, over the last 36 months. |
| Coverage | `coverage_pct` / `coveragePct` | % | Demand coverage only; not month reporting. |

Scope label for all municipalities: `all_municipalities` follows the active municipality list from the database. Use `scope_all_label(count)` in Python and `scopeAllLabel(count)` in React; never hardcode a number (and never use "province-wide" or "Pangasinan total").

Forecast method display names: `linear_regression` = Linear Regression, `random_forest` = Random Forest, `arima` = ARIMA, `sarimax` = SARIMAX, `seasonal_anchor` = Seasonal baseline (last complete year), `none` = Not forecast (insufficient data).

Main views never show acronyms (MAE, RMSE, MAPE, R², model orders); they appear only in the collapsed "How this forecast was made" panel, plain-English name first, acronym in parentheses.
