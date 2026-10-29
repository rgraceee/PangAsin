// WHAT: Single source of truth for labels, units, enum display names and
//       one-sentence definitions used across the admin analytics UI.
// WHY: One term = one meaning everywhere (UI, API fields, code). Components
//      render from here; no hard-coded label strings. Keep this file in sync
//      with app/labels.js.
//
// Naming: code names are camelCase (React). Each entry is an object:
//   label   - human-readable UI label
//   unit    - display unit (Metric Tons (MT), %, m², Metric Tons (MT) per bed, Metric Tons (MT) per hectare, month) or null
//   defn    - one-sentence plain-language definition (for info tooltips)
//   scope   - where it applies: "kpi", "chart", "table", "tooltip", "endpoint"

export const UNIT_MT = "Metric Tons (MT)";
export const UNIT_PCT = "%";
export const UNIT_M2 = "m²";
export const UNIT_MT_PER_BED = "Metric Tons (MT) per bed";
export const UNIT_MT_PER_HA = "Metric Tons (MT) per hectare";
export const UNIT_MONTH = "month";

export const SCOPE_ALL = "all_municipalities";
// WHAT: Template + helper for the province-wide scope label.
// WHY: The municipality list is database-managed, so the number of active
//      municipalities must be passed in instead of hard-coding "7".
export const SCOPE_ALL_LABEL_TEMPLATE = "All {count} municipalities";
export const scopeAllLabel = (count) =>
  (Number(count) > 1
    ? SCOPE_ALL_LABEL_TEMPLATE.replace("{count}", String(count))
    : "All municipalities");
export const SCOPE_ALL_NOTE =
  "Scope label used for the province-wide view. Never \"province-wide\" or \"Pangasinan total\".";

export const LABELS = {
  // --- Recorded production ---
  recordedMt: {
    label: "Recorded production",
    unit: UNIT_MT,
    defn: "Total approved production volume, in metric tons (MT), from validated records only.",
    scope: "kpi",
  },
  forecastMt: {
    label: "Forecast production",
    unit: UNIT_MT,
    defn: "Model-predicted production volume for a future month, in metric tons (MT).",
    scope: "kpi",
  },
  forecastTotalMt: {
    label: "Forecast production total",
    unit: UNIT_MT,
    defn: "Sum of monthly forecast volumes over the selected horizon, in metric tons (MT).",
    scope: "kpi",
  },
  // --- Demand / supply benchmarks ---
  localProductionMt: {
    label: "Local production (benchmark)",
    unit: UNIT_MT,
    defn: "Benchmark figure for local salt production, in metric tons (MT), from the demand benchmark table.",
    scope: "kpi",
  },
  demandMt: {
    label: "Salt demand",
    unit: UNIT_MT,
    defn: "Annual salt demand benchmark, in metric tons (MT), from the provincial demand benchmark.",
    scope: "kpi",
  },
  demandShortfallMt: {
    label: "Demand shortfall",
    unit: UNIT_MT,
    defn: "Forecast production minus salt demand, in metric tons (MT). A negative value is a surplus.",
    scope: "kpi",
  },
  recordedCoveragePct: {
    label: "Recorded coverage",
    unit: UNIT_PCT,
    defn: "Approved recorded production divided by salt demand, as a percentage. Counts approved records from active municipalities only; actual production may be higher.",
    scope: "kpi",
  },
  recordedShareOfLocalPct: {
    label: "Share of local production",
    unit: UNIT_PCT,
    defn: "Recorded production as a share of local production benchmark, as a percentage.",
    scope: "kpi",
  },
  importSharePct: {
    label: "Import share of demand",
    unit: UNIT_PCT,
    defn: "Import volume as a share of salt demand, as a percentage.",
    scope: "kpi",
  },
  productionTargetMt: {
    label: "Production target",
    unit: UNIT_MT,
    defn: "Monthly or annual production goal, in metric tons (MT), set by the user for target checking.",
    scope: "kpi",
  },
  // --- Data sufficiency / confidence / method ---
  dataSufficiency: {
    label: "Data sufficiency",
    unit: null,
    defn: "Whether there is enough history to forecast: Sufficient, Limited, or Insufficient.",
    scope: "kpi",
  },
  forecastConfidence: {
    label: "Forecast confidence",
    unit: null,
    defn: "Combines amount of data and past accuracy; High, Moderate, or Low. Not a statistical confidence level.",
    scope: "kpi",
  },
  forecastMethod: {
    label: "Forecast method",
    unit: null,
    defn: "The selected forecast candidate (ARIMA, SARIMA, seasonal naive, or not forecast).",
    scope: "kpi",
  },
  rangeLowMt: {
    label: "Expected range low",
    unit: UNIT_MT,
    defn: "Lower bound of the 90% expected range for forecast production, in metric tons (MT).",
    scope: "kpi",
  },
  rangeHighMt: {
    label: "Expected range high",
    unit: UNIT_MT,
    defn: "Upper bound of the 90% expected range for forecast production, in metric tons (MT).",
    scope: "kpi",
  },
  trendDirection: {
    label: "Direction",
    unit: null,
    defn: "Whether production is trending Increasing, Stable, or Declining.",
    scope: "kpi",
  },
  changeVsRecentAvgPct: {
    label: "Change vs recent average",
    unit: UNIT_PCT,
    defn: "Percentage change of forecast versus the recent historical average.",
    scope: "kpi",
  },
  partialReportingTail: {
    label: "Incomplete recent months",
    unit: null,
    defn: "Flag indicating the most recent year is under-reported relative to the latest complete year.",
    scope: "kpi",
  },
  backtest: {
    label: "Accuracy check",
    unit: null,
    defn: "Holdout comparison of actual vs predicted values for the chosen model.",
    scope: "chart",
  },
  maeMt: {
    label: "Average error",
    unit: UNIT_MT,
    defn: "Mean Absolute Error of the chosen model, in metric tons (MT).",
    scope: "tooltip",
  },
  rmseMt: {
    label: "Typical error",
    unit: UNIT_MT,
    defn: "Root Mean Square Error of the chosen model, in metric tons (MT).",
    scope: "tooltip",
  },
  mapePct: {
    label: "Average error",
    unit: UNIT_PCT,
    defn: "Mean Absolute Percentage Error of the chosen model, as a percentage.",
    scope: "tooltip",
  },
  // --- Seasonal / yield / geography ---
  seasonalPattern: {
    label: "Seasonal pattern",
    unit: null,
    defn: "Average production by calendar month, replacing the older heatmap view.",
    scope: "chart",
  },
  municipalityForecastSummary: {
    label: "Municipality forecast summary",
    unit: null,
    defn: "Per-municipality forecast volumes and method, replacing the older outlook table.",
    scope: "table",
  },
  yieldPerBedMt: {
    label: "Yield per salt bed",
    unit: UNIT_MT_PER_BED,
    defn: "Recorded production divided by number of salt beds, in metric tons (MT) per bed.",
    scope: "kpi",
  },
  yieldPerHaMt: {
    label: "Yield per hectare",
    unit: UNIT_MT_PER_HA,
    defn: "Recorded production divided by total production area (num_salt_beds × area_per_salt_bed, m² converted to hectares), in metric tons (MT) per hectare. area_per_salt_bed is stored in m².",
    scope: "kpi",
  },
  // --- Reporting completeness ---
  reportingGrid: {
    label: "Reporting completeness",
    unit: null,
    defn: "Which months each municipality reported approved records, over the last 36 months.",
    scope: "table",
  },
  coveragePct: {
    label: "Coverage",
    unit: UNIT_PCT,
    defn: "Demand coverage only (recorded production / demand). Not month reporting.",
    scope: "kpi",
  },
};

export const FORECAST_METHOD_NAMES = {
  linear_regression: "Linear Regression",
  random_forest: "Random Forest",
  arima: "ARIMA",
  sarima: "SARIMA",
  sarimax: "SARIMA",
  seasonal_anchor: "Seasonal baseline (last complete year)",
  seasonal_baseline: "Seasonal baseline (last complete year)",
  none: "Not forecast (insufficient data)",
};

export const FORECAST_METHOD_ACRONYMS = {
  linear_regression: "Linear Regression",
  random_forest: "Random Forest",
  arima: "ARIMA",
  sarima: "SARIMA",
  sarimax: "SARIMA",
};

export const DATA_SUFFICIENCY = {
  ready: "Ready",
  sufficient: "Sufficient",
  limited: "Limited data",
  not_ready: "Not enough data",
  insufficient: "Insufficient",
};

export const FORECAST_CONFIDENCE = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
};

export const TREND_LABELS = {
  increasing: "Increasing",
  stable: "Stable",
  declining: "Declining",
};

export const STATUS_LABELS = {
  approved: { label: "Approved", tone: "good" },
  pending: { label: "Pending", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
};

// Only these three statuses are exposed in every filter dropdown and badge.
export const STATUS_OPTIONS = ["pending", "approved", "rejected"];

export const PAGE_DESCRIPTIVE = "Descriptive: What our data shows";
export const PAGE_PREDICTIVE = "Predictive: What to expect";
export const TAB_DESCRIPTIVE = "descriptive";
export const TAB_PREDICTIVE = "predictive";
export const PAGE_TARGET_CHECK = "Target check";

// WHAT: Human-readable column headings for report previews and exports.
// WHY: Raw field keys (e.g. production_mt) are code names, not labels. Keep this
//      map in sync with DISPLAY_HEADERS in app/services/report_service.py.
export const DISPLAY_HEADERS = {
  municipality: "Municipality",
  barangay: "Barangay",
  barangay_id: "Barangay",
  record_date: "Record Date",
  production_volume_mt: "Production Volume (Metric Tons (MT))",
  production_mt: "Production (Metric Tons (MT))",
  total_production_mt: "Total Production (Metric Tons (MT))",
  record_count: "Records",
  total_salt_beds: "Total Salt Beds",
  num_salt_beds: "Salt Beds",
  area_per_salt_bed: "Area per Salt Bed (m²)",
  area_per_salt_bed_sqm: "Area per Salt Bed (m²)",
  total_area_sqm: "Total Area (m²)",
  production_area_sqm: "Production Area (m²)",
  total_production_area_sqm: "Total Production Area (m²)",
  production_method: "Production Method",
  production_methods: "Production Methods",
  registered_producers: "Registered Salt Farmers",
  total_registered_producers: "Total Registered Salt Farmers",
  male_producers: "Male Salt Farmers",
  total_male_producers: "Total Male Salt Farmers",
  female_producers: "Female Salt Farmers",
  total_female_producers: "Total Female Salt Farmers",
  other_producers: "Other Salt Farmers",
  total_other_producers: "Total Other Salt Farmers",
  month: "Month",
  name: "Name",
  age: "Age",
  age_bracket: "Age Bracket",
  sex: "Sex",
  address: "Address",
  submitted_at: "Submitted At",
  algorithm: "Algorithm",
  readiness: "Readiness",
  reliability: "Reliability",
  trend_direction: "Trend",
  expected_change_pct: "Expected Change (%)",
  projected_total_mt: "Projected Total (Metric Tons (MT))",
  mae: "MAE (Metric Tons (MT))",
  rmse: "RMSE (Metric Tons (MT))",
  mape: "MAPE (%)",
  r2: "R²",
  period: "Period",
  latitude: "Latitude",
  longitude: "Longitude",
  quality_score: "Quality Score (%)",
  overall_quality_score: "Overall Quality Score (%)",
  total_records: "Total Records",
  total_reports: "Total Environment Reports",
  year: "Year",
  demand_volume_mt: "Demand Volume (Metric Tons (MT))",
  local_production_mt: "Local Production (Metric Tons (MT))",
  import_volume_mt: "Import Volume (Metric Tons (MT))",
  source: "Source",
};

function humanize(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function displayHeader(key) {
  if (key in DISPLAY_HEADERS) return DISPLAY_HEADERS[key];
  if (String(key).startsWith("completeness_")) {
    const inner = String(key).slice("completeness_".length);
    const base = (DISPLAY_HEADERS[inner] ?? humanize(inner)).split(" (")[0];
    return `${base} Completeness (%)`;
  }
  return humanize(key);
}

export function get(code, defaultValue = {}) {
  return LABELS[code] || defaultValue;
}

export function label(code, defaultValue = null) {
  const entry = LABELS[code];
  if (!entry) return defaultValue ?? code;
  return entry.label;
}

export function unit(code, defaultValue = null) {
  const entry = LABELS[code];
  if (!entry) return defaultValue;
  return entry.unit;
}

export function definition(code, defaultValue = null) {
  const entry = LABELS[code];
  if (!entry) return defaultValue ?? "";
  return entry.defn;
}

export function methodName(code) {
  return FORECAST_METHOD_NAMES[code] ?? code;
}

export function methodAcronym(code) {
  return FORECAST_METHOD_ACRONYMS[code] ?? code;
}
