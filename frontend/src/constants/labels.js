// WHAT: Single source of truth for labels, units, enum display names and
//       one-sentence definitions used across the admin analytics UI.
// WHY: One term = one meaning everywhere (UI, API fields, code). Components
//      render from here; no hard-coded label strings. Keep this file in sync
//      with app/labels.js.
//
// Naming: code names are camelCase (React). Each entry is an object:
//   label   - human-readable UI label
//   unit    - display unit (MT, %, m², MT per bed, MT per hectare, month) or null
//   defn    - one-sentence plain-language definition (for info tooltips)
//   scope   - where it applies: "kpi", "chart", "table", "tooltip", "endpoint"

export const UNIT_MT = "MT";
export const UNIT_PCT = "%";
export const UNIT_M2 = "m²";
export const UNIT_MT_PER_BED = "MT per bed";
export const UNIT_MT_PER_HA = "MT per hectare";
export const UNIT_MONTH = "month";

export const SCOPE_ALL = "all_municipalities";
export const SCOPE_ALL_LABEL = "All 7 municipalities";
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
    defn: "Approved recorded production divided by salt demand, as a percentage. Counts approved records from the 7 salt-producing municipalities only; actual production may be higher.",
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
  draft: { label: "Draft", tone: "info" },
  returned: { label: "Returned", tone: "warning" },
};

export const PAGE_DESCRIPTIVE = "Descriptive: What our data shows";
export const PAGE_PREDICTIVE = "Predictive: What to expect";
export const TAB_DESCRIPTIVE = "descriptive";
export const TAB_PREDICTIVE = "predictive";
export const PAGE_TARGET_CHECK = "Target check";

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
