"""Verify app/labels.py and frontend/src/constants/labels.js stay in sync.

One term = one meaning everywhere (UI, API fields, code). This script asserts
that the forecast-related label codes and units match between the Python
registry (single source of truth) and the React mirror, and that the trend
direction thresholds (±2%) are identical in both backends.

Read-only: does not write to the database.
"""
import os
import re
import sys

# Resolve paths relative to this script (scripts/).
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PY_LABELS = os.path.join(ROOT, "app", "labels.py")
JS_LABELS = os.path.join(ROOT, "frontend", "src", "constants", "labels.js")

failures = []
passes = []


def check(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}" + (f"  -- {detail}" if detail else ""))
    if ok:
        passes.append(name)
    else:
        failures.append(name)


# ---------------------------------------------------------------------------
# Python side
# ---------------------------------------------------------------------------
sys.path.insert(0, ROOT)
os.environ.setdefault("FLASK_ENV", "development")

from app import create_app  # noqa: E402

app = create_app()
with app.app_context():
    from app.labels import LABELS  # noqa: E402
    from app.services.forecast_service import _trend_direction  # noqa: E402

    py_units = {}
    for code, entry in LABELS.items():
        py_units[code] = entry.get("unit")

# ---------------------------------------------------------------------------
# JavaScript side (line-by-line parse, no JS runtime needed)
# ---------------------------------------------------------------------------
UNIT_ALIASES = {
    "UNIT_MT": "MT",
    "UNIT_PCT": "%",
    "UNIT_M2": "m²",
    "UNIT_MT_PER_BED": "MT per bed",
    "UNIT_MT_PER_HA": "MT per hectare",
    "UNIT_MONTH": "month",
    "null": None,
}

js_units = {}
js_codes = []
current_code = None
top_level_re = re.compile(r"^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{\s*$")
unit_re = re.compile(r"^\s{4}unit:\s*(.+?),?\s*$")


def to_camel(snake):
    parts = snake.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])

with open(JS_LABELS, "r", encoding="utf-8") as fh:
    for line in fh:
        m = top_level_re.match(line)
        if m:
            current_code = m.group(1)
            js_codes.append(current_code)
            continue
        if current_code is not None:
            m = unit_re.match(line)
            if m:
                raw = m.group(1).strip()
                # Strip inline comments and quotes.
                raw = re.sub(r"\s*//.*$", "", raw).strip()
                if raw.startswith('"') and raw.endswith('"'):
                    raw = raw[1:-1]
                elif raw.startswith("'") and raw.endswith("'"):
                    raw = raw[1:-1]
                js_units[current_code] = UNIT_ALIASES.get(raw, raw)
                current_code = None  # unit recorded; wait for next top-level key

js_code_set = set(js_codes)
# Python uses snake_case; JS uses camelCase. Normalize Python -> camelCase to compare.
py_code_camel = {to_camel(c): c for c in py_units.keys()}
py_code_set_camel = set(py_code_camel.keys())

# ---- 1) Code sets must match exactly (snake_case <-> camelCase) -----------
only_in_py = sorted(py_code_set_camel - js_code_set)
only_in_js = sorted(js_code_set - py_code_set_camel)
check(
    "Label code sets identical (Python snake_case <-> JS camelCase)",
    not only_in_py and not only_in_js,
    f"only_in_py={only_in_py} only_in_js={only_in_js}",
)

# ---- 2) Units must match for shared codes ---------------------------------
unit_mismatches = []
for camel in sorted(py_code_set_camel & js_code_set):
    py_code = py_code_camel[camel]
    pu = py_units[py_code]
    ju = js_units.get(camel)
    if pu != ju:
        unit_mismatches.append(f"{py_code} ({camel}): py={pu!r} js={ju!r}")
check(
    "Label units identical for shared codes",
    not unit_mismatches,
    "; ".join(unit_mismatches) if unit_mismatches else "",
)

# ---- 3) Forecast-critical codes present in both ---------------------------
forecast_codes = [
    "recorded_mt",
    "forecast_mt",
    "forecast_total_mt",
    "demand_mt",
    "demand_shortfall_mt",
    "trend_direction",
    "change_vs_recent_avg_pct",
    "forecast_confidence",
    "forecast_method",
    "data_sufficiency",
    "range_low_mt",
    "range_high_mt",
    "municipality_forecast_summary",
]
missing_forecast = [
    c for c in forecast_codes
    if c not in py_units or to_camel(c) not in js_code_set
]
check(
    "Forecast-critical codes present in both registries",
    not missing_forecast,
    f"missing={missing_forecast}",
)

# ---- 4) Trend direction thresholds (±2%) identical in Python & JS ---------
td_cases = [
    (30.62, "increasing"),   # Infanta case: +30.6% must be increasing
    (3.0, "increasing"),
    (2.0, "stable"),          # boundary: exactly +2% is stable
    (0.0, "stable"),
    (-2.0, "stable"),         # boundary: exactly -2% is stable
    (-3.0, "declining"),
    (None, "stable"),
]
td_ok = True
for val, expected in td_cases:
    got = _trend_direction(val)
    if got != expected:
        td_ok = False
        print(f"    [FAIL] _trend_direction({val!r}) = {got!r}, expected {expected!r}")
check("Python _trend_direction thresholds (±2%) correct", td_ok)

# JS directionFromPct must use the same thresholds (grep the source).
with open(os.path.join(ROOT, "frontend", "src", "components", "admin", "ForecastDashboard.jsx"),
          "r", encoding="utf-8") as fh:
    js_src = fh.read()
has_gt2 = bool(re.search(r"changePct\s*>\s*2", js_src))
has_lt_neg2 = bool(re.search(r"changePct\s*<\s*-2", js_src))
check(
    "JS directionFromPct uses ±2% thresholds",
    has_gt2 and has_lt_neg2,
    f"changePct>2={has_gt2} changePct<-2={has_lt_neg2}",
)

# ---- 5) camelCase JS keys exist for forecast codes ------------------------
missing_js_keys = []
for code in forecast_codes:
    camel = to_camel(code)
    if camel not in js_code_set:
        missing_js_keys.append(f"{code} -> {camel}")
check(
    "Forecast codes have camelCase JS keys",
    not missing_js_keys,
    f"missing={missing_js_keys}",
)

print(f"\nPASSED: {len(passes)}  FAILED: {len(failures)}")
sys.exit(1 if failures else 0)
