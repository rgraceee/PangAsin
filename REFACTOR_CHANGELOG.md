# Refactor Changelog

Behavior stayed identical: no routes, API response shapes, DB schema, env/config
values, or UI behavior were changed. No features added.

Verified: `pytest -q` = 53/53 passing; `npm run build` succeeds; smoke routes
`/`, `/login`, `/admin`, `/encoder`, `/admin/forecast` all return 200.

One commit per batch (Batches 2, 3, 4a, 4b, 4c, 5); nothing pushed.

## Deleted

- `app/templates/landing_base.html` (inlined into `public/landing.html`)
- `frontend/src/components/admin/forecast/forecastChartBits.jsx` (merged into `ForecastChartCard.jsx`)
- `frontend/src/components/admin/municipality/muniSelectors.js` (merged into `municipalityData.js`)
- `frontend/src/components/encoder/ReportField.jsx` (merged into `ReportFormParts.jsx`)
- `frontend/src/components/encoder/ReportSection.jsx` (merged into `ReportFormParts.jsx`)
- `frontend/src/components/encoder/ReportStepper.jsx` (merged into `ReportFormParts.jsx`)
- `frontend/src/components/encoder/ReportSummary.jsx` (merged into `ReportFormParts.jsx`)

## Renamed (old -> new)

Backend:
- `app/services/municipalities.py` -> `app/services/municipality_directory.py`
- `app/services/aggregates.py` -> `app/services/production_aggregates.py`
- `_parse_date` -> `parse_iso_date` (in `app/utils.py`)
- `_admin_only` -> `is_not_admin` (in `app/utils.py`)
- `admin_api`: `stats` -> `get_dashboard_stats`; `trends` -> `get_production_trends` (routes `/stats`, `/trends` unchanged)
- `encoder_api`: `_validate` -> `validate_production_record`; `_allocate` -> `apply_record_payload`; `_serialize` -> `serialize_record`

Frontend:
- `frontend/src/components/admin/forecast/forecastMuniBits.jsx` -> `ForecastMunicipalityTooltip.jsx`
- `frontend/src/components/admin/municipality/muni.css` -> `municipality.css`
- `frontend/src/components/admin/municipality/muniData.js` -> `municipalityData.js`
- `frontend/src/components/admin/municipality/muniTooltips.jsx` -> `municipalityTooltips.jsx`
- `frontend/src/components/shell/sidebarKit.jsx` -> `sidebarUi.jsx`

## Merged

- `municipalitySelectors.js` -> `municipalityData.js` (selector functions moved into the data file; `municipalitySelectors.js` deleted)
- `forecastChartBits.jsx` -> `ForecastChartCard.jsx` (tooltips/constants/marker moved into the card file; `forecastChartBits.jsx` deleted)
- `ReportField.jsx`, `ReportSection.jsx`, `ReportStepper.jsx`, `ReportSummary.jsx` -> `ReportFormParts.jsx` (named exports; all importers updated)
- `landing_base.html` -> `public/landing.html` (base template inlined into the landing page; `landing_base.html` deleted)

## Added (new files)

- `app/services/date_math.py` — shared month-math helpers (`shift_month`, `add_months`, `month_start_offset`, `grid_start_end`, `month_bounds`) extracted from `admin_api`, `analytics_api`, `aggregates`, `forecast_service`
- `frontend/src/components/encoder/ReportFormParts.jsx` — merged report form parts

## Simplified

- Consolidated the 7 MT formatters into one parameterized `fmtMT` helper in `frontend/src/utils/volumeFormat.js`, preserving each call's decimals/sentinel/locale. Callers: `AdminDashboard.jsx`, `SupplyDemandAnalytics.jsx`, `municipalityData.js`, `targetData.js`, `forecastData.js`, `publicChartTheme.js`. Legacy `formatMT`/`formatMTWithUnit` kept as aliases for existing importers.
- Moved pure formatters out of `GenerateReports.jsx` into `utils/reportFormatters.js` (`reportTypeLabel`, typed label map passed in).
- Replaced long JSX ternaries in `Municipalities.jsx` with named helpers (`encoderEmailList`, `editStatusClassName`, `editStatusMessage`, `boundaryFileRef`, `saveButtonContent`); JSX structure unchanged.
- Added `# WHAT:` / `# WHY:` comments above logical blocks throughout the touched files (simple English / Taglish).

## Left untouched (per instructions)

`DevelopmentConfig`/`ProductionConfig` in `app/config.py`; `admin_api.create_user` stub; `/analytics/predictive`; `requirements.txt`; frontend slug normalizers; label registries (`app/labels.py`, `frontend/src/constants/labels.js`); `app/static/reports/*`; `app/static/react/assets/index-CazLJ-I9.js`; imports in `app/models/__init__.py`; forgot-password and forced-password-change code.

## Later (not built now, not made harder)

SuperAdmin role — role checks still scattered as `role == "admin"` in `app/utils.py`, `producers_api.py`, `App.jsx`, `RequireAdmin.jsx`.
