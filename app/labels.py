# WHAT: Single source of truth for labels, units, enum display names and
#       one-sentence definitions used across the admin analytics UI and API.
# WHY: One term = one meaning everywhere (UI, API fields, code). Components and
#      endpoints render from here; no hard-coded label strings. Keep this file
#      in sync with frontend/src/constants/labels.js.
#
# Naming: CODE_NAME is snake_case (Python/API). Each entry is a dict:
#   label   - human-readable UI label (Title Case / Sentence case as appropriate)
#   unit    - display unit (Metric Tons (MT), %, m², Metric Tons (MT) per bed, Metric Tons (MT) per hectare, month) or None
#   defn    - one-sentence plain-language definition
#   scope   - where it applies: "kpi", "chart", "table", "tooltip", "endpoint"

# ---------------------------------------------------------------------------
# Units (display strings)
# ---------------------------------------------------------------------------
UNIT_MT = "Metric Tons (MT)"
UNIT_PCT = "%"
UNIT_M2 = "m²"
UNIT_MT_PER_BED = "Metric Tons (MT) per bed"
UNIT_MT_PER_HA = "Metric Tons (MT) per hectare"
UNIT_MONTH = "month"

# ---------------------------------------------------------------------------
# Scope label
# ---------------------------------------------------------------------------
SCOPE_ALL = "all_municipalities"
SCOPE_ALL_LABEL = "All 7 municipalities"
SCOPE_ALL_NOTE = "Scope label used for the province-wide view. Never \"province-wide\" or \"Pangasinan total\"."

# ---------------------------------------------------------------------------
# Label registry: code_name -> {label, unit, defn, scope}
# ---------------------------------------------------------------------------
LABELS = {
    # --- Recorded production ---
    "recorded_mt": {
        "label": "Recorded production",
        "unit": UNIT_MT,
        "defn": "Total approved production volume, in metric tons (MT), from validated records only.",
        "scope": "kpi",
    },
    "forecast_mt": {
        "label": "Forecast production",
        "unit": UNIT_MT,
        "defn": "Model-predicted production volume for a future month, in metric tons (MT).",
        "scope": "kpi",
    },
    "forecast_total_mt": {
        "label": "Forecast production total",
        "unit": UNIT_MT,
        "defn": "Sum of monthly forecast volumes over the selected horizon, in metric tons (MT).",
        "scope": "kpi",
    },
    # --- Demand / supply benchmarks ---
    "local_production_mt": {
        "label": "Local production (benchmark)",
        "unit": UNIT_MT,
        "defn": "Benchmark figure for local salt production, in metric tons (MT), from the demand benchmark table.",
        "scope": "kpi",
    },
    "demand_mt": {
        "label": "Salt demand",
        "unit": UNIT_MT,
        "defn": "Annual salt demand benchmark, in metric tons (MT), from the provincial demand benchmark.",
        "scope": "kpi",
    },
    "demand_shortfall_mt": {
        "label": "Demand shortfall",
        "unit": UNIT_MT,
        "defn": "Forecast production minus salt demand, in metric tons (MT). A negative value is a surplus.",
        "scope": "kpi",
    },
    "recorded_coverage_pct": {
        "label": "Recorded coverage",
        "unit": UNIT_PCT,
        "defn": "Approved recorded production divided by salt demand, as a percentage. Counts approved records from the 7 salt-producing municipalities only; actual production may be higher.",
        "scope": "kpi",
    },
    "recorded_share_of_local_pct": {
        "label": "Share of local production",
        "unit": UNIT_PCT,
        "defn": "Recorded production as a share of local production benchmark, as a percentage.",
        "scope": "kpi",
    },
    "import_share_pct": {
        "label": "Import share of demand",
        "unit": UNIT_PCT,
        "defn": "Import volume as a share of salt demand, as a percentage.",
        "scope": "kpi",
    },
    "production_target_mt": {
        "label": "Production target",
        "unit": UNIT_MT,
        "defn": "Monthly or annual production goal, in metric tons (MT), set by the user for target checking.",
        "scope": "kpi",
    },
    # --- Data sufficiency / confidence / method ---
    "data_sufficiency": {
        "label": "Data sufficiency",
        "unit": None,
        "defn": "Whether there is enough history to forecast: Sufficient, Limited, or Insufficient.",
        "scope": "kpi",
    },
    "forecast_confidence": {
        "label": "Forecast confidence",
        "unit": None,
        "defn": "Combines amount of data and past accuracy; High, Moderate, or Low. Not a statistical confidence level.",
        "scope": "kpi",
    },
    "forecast_method": {
        "label": "Forecast method",
        "unit": None,
        "defn": "The selected forecast candidate (ARIMA, SARIMA, seasonal naive, or not forecast).",
        "scope": "kpi",
    },
    "range_low_mt": {
        "label": "Expected range low",
        "unit": UNIT_MT,
        "defn": "Lower bound of the 90% expected range for forecast production, in metric tons (MT).",
        "scope": "kpi",
    },
    "range_high_mt": {
        "label": "Expected range high",
        "unit": UNIT_MT,
        "defn": "Upper bound of the 90% expected range for forecast production, in metric tons (MT).",
        "scope": "kpi",
    },
    "trend_direction": {
        "label": "Direction",
        "unit": None,
        "defn": "Whether production is trending Increasing, Stable, or Declining.",
        "scope": "kpi",
    },
    "change_vs_recent_avg_pct": {
        "label": "Change vs recent average",
        "unit": UNIT_PCT,
        "defn": "Percentage change of forecast versus the recent historical average.",
        "scope": "kpi",
    },
    "partial_reporting_tail": {
        "label": "Incomplete recent months",
        "unit": None,
        "defn": "Flag indicating the most recent year is under-reported relative to the latest complete year.",
        "scope": "kpi",
    },
    "backtest": {
        "label": "Accuracy check",
        "unit": None,
        "defn": "Holdout comparison of actual vs predicted values for the chosen model.",
        "scope": "chart",
    },
    "mae_mt": {
        "label": "Average error",
        "unit": UNIT_MT,
        "defn": "Mean Absolute Error of the chosen model, in metric tons (MT).",
        "scope": "tooltip",
    },
    "rmse_mt": {
        "label": "Typical error",
        "unit": UNIT_MT,
        "defn": "Root Mean Square Error of the chosen model, in metric tons (MT).",
        "scope": "tooltip",
    },
    "mape_pct": {
        "label": "Average error",
        "unit": UNIT_PCT,
        "defn": "Mean Absolute Percentage Error of the chosen model, as a percentage.",
        "scope": "tooltip",
    },
    # --- Seasonal / yield / geography ---
    "seasonal_pattern": {
        "label": "Seasonal pattern",
        "unit": None,
        "defn": "Average production by calendar month, replacing the older heatmap view.",
        "scope": "chart",
    },
    "municipality_forecast_summary": {
        "label": "Municipality forecast summary",
        "unit": None,
        "defn": "Per-municipality forecast volumes and method, replacing the older outlook table.",
        "scope": "table",
    },
    "yield_per_bed_mt": {
        "label": "Yield per salt bed",
        "unit": UNIT_MT_PER_BED,
        "defn": "Recorded production divided by number of salt beds, in metric tons (MT) per bed.",
        "scope": "kpi",
    },
    "yield_per_ha_mt": {
        "label": "Yield per hectare",
        "unit": UNIT_MT_PER_HA,
        "defn": "Recorded production divided by total production area (num_salt_beds × area_per_salt_bed, m² converted to hectares), in metric tons (MT) per hectare. area_per_salt_bed is stored in m².",
        "scope": "kpi",
    },
    # --- Reporting completeness ---
    "reporting_grid": {
        "label": "Reporting completeness",
        "unit": None,
        "defn": "Which months each municipality reported approved records, over the last 36 months.",
        "scope": "table",
    },
    "coverage_pct": {
        "label": "Coverage",
        "unit": UNIT_PCT,
        "defn": "Demand coverage only (recorded production / demand). Not month reporting.",
        "scope": "kpi",
    },
}

# ---------------------------------------------------------------------------
# Forecast method display names (code -> plain-English display)
# ---------------------------------------------------------------------------
FORECAST_METHOD_NAMES = {
    "linear_regression": "Linear Regression",
    "random_forest": "Random Forest",
    "arima": "ARIMA",
    "sarima": "SARIMA",
    "sarimax": "SARIMA",
    "seasonal_anchor": "Seasonal baseline (last complete year)",
    "seasonal_baseline": "Seasonal baseline (last complete year)",
    "none": "Not forecast (insufficient data)",
    "seasonal_baseline_last_complete_year": "Seasonal baseline (last complete year)",
}

FORECAST_METHOD_ACRONYMS = {
    "linear_regression": "Linear Regression",
    "random_forest": "Random Forest",
    "arima": "ARIMA",
    "sarima": "SARIMA",
    "sarimax": "SARIMA",
}

# ---------------------------------------------------------------------------
# Data sufficiency levels
# ---------------------------------------------------------------------------
DATA_SUFFICIENCY_SUFFICIENT = "sufficient"
DATA_SUFFICIENCY_LIMITED = "limited"
DATA_SUFFICIENCY_INSUFFICIENT = "insufficient"

DATA_SUFFICIENCY_LABELS = {
    DATA_SUFFICIENCY_SUFFICIENT: "Sufficient",
    DATA_SUFFICIENCY_LIMITED: "Limited",
    DATA_SUFFICIENCY_INSUFFICIENT: "Insufficient",
}

# ---------------------------------------------------------------------------
# Forecast confidence levels
# ---------------------------------------------------------------------------
FORECAST_CONFIDENCE_HIGH = "high"
FORECAST_CONFIDENCE_MODERATE = "moderate"
FORECAST_CONFIDENCE_LOW = "low"

FORECAST_CONFIDENCE_LABELS = {
    FORECAST_CONFIDENCE_HIGH: "High",
    FORECAST_CONFIDENCE_MODERATE: "Moderate",
    FORECAST_CONFIDENCE_LOW: "Low",
}

# ---------------------------------------------------------------------------
# Trend directions
# ---------------------------------------------------------------------------
TREND_INCREASING = "increasing"
TREND_STABLE = "stable"
TREND_DECLINING = "declining"

TREND_LABELS = {
    TREND_INCREASING: "Increasing",
    TREND_STABLE: "Stable",
    TREND_DECLINING: "Declining",
}

# ---------------------------------------------------------------------------
# Status meanings (shared across pages)
# ---------------------------------------------------------------------------
STATUS_LABELS = {
    "approved": {"label": "Approved", "tone": "good"},
    "pending": {"label": "Pending", "tone": "warning"},
    "rejected": {"label": "Rejected", "tone": "danger"},
}

# ---------------------------------------------------------------------------
# Page / tab names
# ---------------------------------------------------------------------------
PAGE_DESCRIPTIVE = "Descriptive: What our data shows"
PAGE_PREDICTIVE = "Predictive: What to expect"
TAB_DESCRIPTIVE = "descriptive"
TAB_PREDICTIVE = "predictive"
PAGE_TARGET_CHECK = "Target check"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get(code, default=None):
    """Return the label registry entry for a code, or default if missing."""
    return LABELS.get(code, default or {})

def label(code, default=None):
    """Return the human-readable label for a code."""
    return get(code, default).get("label", default or code)

def unit(code, default=None):
    """Return the display unit for a code."""
    return get(code, default).get("unit", default)

def definition(code, default=None):
    """Return the one-sentence definition for a code (used in info tooltips)."""
    return get(code, default).get("defn", default or "")

def method_name(code):
    """Return the plain-English display name for a forecast method code."""
    return FORECAST_METHOD_NAMES.get(code, code)
