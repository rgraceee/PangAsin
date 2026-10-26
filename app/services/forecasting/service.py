"""
app/services/forecasting/service.py

Glue between model.py and the existing ForecastRun / ForecastPoint tables.
Nothing here imports Flask or your models at import time: the db object and the two model classes
are passed in by the caller, so this file cannot break app start-up.

!! Things to CHECK against the rest of your app (all are plain constants below) !!
    - UNIT_DIVISOR   : the model works in kg. Use 1000.0 if the app stores/shows metric tons.
    - READY / HIGH / UP ... : the exact strings your UI/templates expect in
                              readiness / reliability / trend_direction.
    - period_label   : "YYYY-MM" here; change _label() if the app uses another format.
"""
from __future__ import annotations

import math

import pandas as pd

try:
    from . import model as fm
except ImportError:          # running the file directly / from its own folder
    import model as fm

# ----------------------------------------------------------------- CONSTANTS (adjust to your app)
UNIT_DIVISOR = 1.0                 # 1.0 = store kg, 1000.0 = store MT
READY, NOT_READY = "ready", "not_ready"
HIGH, MEDIUM, LOW = "high", "medium", "low"
UP, DOWN, STABLE = "up", "down", "stable"
TREND_THRESHOLD_PCT = 5.0          # |expected change| below this counts as "stable"
HISTORY_POINTS = 12                # past months saved next to the forecast (is_forecast=False)
_RELIABILITY_ORDER = [LOW, MEDIUM, HIGH]


def _clean(x, lo=None, hi=None, nd=5):
    """float or None. NaN/inf become None; values are clipped to what the DB column allows."""
    if x is None:
        return None
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(x):
        return None
    if lo is not None:
        x = max(x, lo)
    if hi is not None:
        x = min(x, hi)
    return round(x, nd)


def _label(ts) -> str:
    return f"{ts:%Y-%m}"


def classify(n_months, mase):
    """(readiness, reliability). Simple, explainable rules. Edit freely and document them in the paper."""
    if n_months < fm.MIN_MONTHS or mase is None or not math.isfinite(mase):
        return NOT_READY, LOW
    if mase < 0.5 and n_months >= 36:
        return READY, HIGH
    if mase < 1.0:
        return READY, MEDIUM
    return READY, LOW


def build_run(result: dict, note: str = "", incomplete_tail: bool = False, override: dict | None = None):
    """model result -> (fields for ForecastRun, list of dicts for ForecastPoint). Pure; no DB."""
    fc, hist = result["forecast"], result["history_kg"]
    best = next((m for m in result.get("metrics", []) if m["model"] == result["best_model"]), None)
    readiness, reliability = classify(result.get("n_months", len(hist)), best["mase"] if best else None)

    projected = float(fc["predicted_kg"].sum())
    base = float(hist.iloc[-len(fc):].sum()) if len(hist) >= len(fc) else None   # same-length window of actuals
    pct = (projected - base) / base * 100 if base and base > 0 else None
    if pct is None:
        trend = STABLE
    elif pct > TREND_THRESHOLD_PCT:
        trend = UP
    elif pct < -TREND_THRESHOLD_PCT:
        trend = DOWN
    else:
        trend = STABLE

    d = UNIT_DIVISOR
    fields = {
        "period_start": fc.index[0].date(),
        "period_end": (fc.index[-1] + pd.offsets.MonthEnd(0)).date(),
        "algorithm": result["best_model"],
        "readiness": readiness,
        "reliability": reliability,
        "trend_direction": trend,
        "expected_change_pct": _clean(pct, -100.0, 9999.99, 2),       # Numeric(6,2) + CHECK >= -100
        "projected_total": _clean(projected / d, 0.0),                 # CHECK >= 0
        "mae": _clean(best["mae"] / d) if best else None,
        "rmse": _clean(best["rmse"] / d) if best else None,
        "mape": _clean(best["mape"], 0.0, 1e9, 2) if best else None,
        "r2": _clean(best["r2"], nd=6) if best else None,
        "candidate_metrics": {
            "unit": "kg" if d == 1.0 else "scaled by 1/%s" % d,
            "evaluation": "hold-out of the last %d months, models fitted on earlier months only" % fm.EVAL_HORIZON,
            "models": [
                {"model": m["model"], "mae": _clean(m["mae"] / d), "rmse": _clean(m["rmse"] / d),
                 "mape": _clean(m["mape"], 0.0, 1e9, 2), "r2": _clean(m["r2"], nd=6), "mase": _clean(m["mase"], nd=4)}
                for m in result.get("metrics", [])
            ],
            "failed": result.get("failures", {}),
        },
        "incomplete_tail": bool(incomplete_tail),
        "note": note or None,
    }
    if override:
        fields.update(override)

    points = []
    for ts, v in hist.iloc[-HISTORY_POINTS:].items():
        points.append({"period_label": _label(ts), "predicted_value": _clean(v / d, 0.0) if pd.notna(v) else None,
                       "lower_bound": None, "upper_bound": None, "is_forecast": False})
    for ts, row in fc.iterrows():
        points.append({"period_label": _label(ts), "predicted_value": _clean(row["predicted_kg"] / d, 0.0),
                       "lower_bound": _clean(row["lower_kg"] / d, 0.0), "upper_bound": _clean(row["upper_kg"] / d, 0.0),
                       "is_forecast": True})
    return fields, points


def save_forecast(db, ForecastRun, ForecastPoint, municipality_id, result, note="", incomplete_tail=False, override=None):
    """
    Save one run + its points. A previous run for the SAME municipality and SAME period is replaced
    (deleted through the ORM so its points go with it). Nothing else in the table is touched.
    municipality_id=None stores the province total (the column is nullable).
    """
    fields, points = build_run(result, note, incomplete_tail, override)
    fields["municipality_id"] = municipality_id
    try:
        old = ForecastRun.query.filter_by(
            municipality_id=municipality_id, period_start=fields["period_start"], period_end=fields["period_end"]
        ).all()
        for r in old:
            db.session.delete(r)
        run = ForecastRun(**fields)
        for p in points:
            run.points.append(ForecastPoint(**p))
        db.session.add(run)
        db.session.commit()
        return run
    except Exception:
        db.session.rollback()
        raise


def run_and_store(db, ForecastRun, ForecastPoint, monthly_df, municipality_ids: dict, horizon=12,
                  note="", model=None, n_jobs=1, **kwargs):
    """
    monthly_df       : columns municipality, year, month, kg
    municipality_ids : {"Alaminos City": 1, ...} built from your municipalities table
    Returns {"saved": [...], "failed": [(name, reason), ...]}. One failure never stops the others.
    """
    series = fm.to_series_dict(monthly_df)
    out = fm.forecast_all(series, horizon=horizon, model=model, n_jobs=n_jobs, **kwargs)
    summary = {"saved": [], "failed": []}
    reliabilities = []

    for r in out["municipalities"]:
        name = r["municipality"]
        if r["status"] != "ok":
            summary["failed"].append((name, r["error"]))
            continue
        if name not in municipality_ids:
            summary["failed"].append((name, "municipality not found in the database"))
            continue
        try:
            run = save_forecast(db, ForecastRun, ForecastPoint, municipality_ids[name], r, note)
            reliabilities.append(run.reliability)
            summary["saved"].append(name)
        except Exception as exc:
            summary["failed"].append((name, f"database error: {exc}"[:300]))

    prov = out["province"]
    if prov is not None:
        worst = min(reliabilities, key=_RELIABILITY_ORDER.index) if reliabilities else LOW
        pnote = note
        if prov["excluded"]:
            pnote = (note + " " if note else "") + "Province total excludes: " + ", ".join(prov["excluded"]) + "."
        try:
            save_forecast(db, ForecastRun, ForecastPoint, None, prov, pnote,
                          override={"readiness": READY if prov["complete"] else NOT_READY, "reliability": worst})
            summary["saved"].append("PROVINCE")
        except Exception as exc:
            summary["failed"].append(("PROVINCE", f"database error: {exc}"[:300]))
    return summary
