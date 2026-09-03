from datetime import date, timedelta
from typing import List, Optional

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor

from app.extensions import db
from app.models.forecast import ForecastRun, ForecastPoint
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality

# Reference epoch for computing real (non-compressed) month positions.
_EPOCH_YEAR = 2000
_EPOCH_MONTH = 1


def _monthly_aggregates(municipality_id: Optional[int], start: date, end: date):
    """Return (labels, values, offsets) of approved production aggregated by month.

    `offsets` are measured in whole months from a fixed epoch, so gaps in the
    record history are represented by larger offsets instead of a compressed
    0..n-1 index. This keeps slopes and spacing honest when months are missing.
    """
    q = (
        ProductionRecord.query
        .filter(ProductionRecord.status == "approved")
        .filter(ProductionRecord.record_date >= start)
        .filter(ProductionRecord.record_date <= end)
    )
    if municipality_id is not None:
        q = q.filter(ProductionRecord.municipality_id == municipality_id)
    q = q.with_entities(
        db.func.date_trunc("month", ProductionRecord.record_date).label("month"),
        db.func.sum(ProductionRecord.production_volume).label("volume"),
    ).group_by(db.text("1")).order_by(db.text("1"))
    rows = q.all()
    labels = []
    values = []
    offsets = []
    for r in rows:
        y = r.month.year
        m = r.month.month
        labels.append(f"{y:04d}-{m:02d}")
        values.append(float(r.volume or 0))
        offsets.append((y - _EPOCH_YEAR) * 12 + (m - _EPOCH_MONTH))
    return labels, values, offsets


def _readiness(label_values):
    unique_months = len(set(label_values))
    if unique_months >= 24:
        return "ready"
    if unique_months >= 12:
        return "limited"
    return "not_ready"


def _reliability(readiness: str, n_points: int) -> str:
    if readiness == "ready" and n_points >= 18:
        return "high"
    if readiness == "ready":
        return "moderate"
    if readiness == "limited":
        return "low"
    return "low"


def _trend_direction(slope_pct: Optional[float]) -> str:
    if slope_pct is None:
        return "stable"
    if slope_pct > 2:
        return "increasing"
    if slope_pct < -2:
        return "declining"
    return "stable"


def _expected_change(values: List[float], forecast_values: List[float]) -> Optional[float]:
    if not values or not forecast_values:
        return None
    hist_avg = sum(values) / len(values)
    fc_avg = sum(forecast_values) / len(forecast_values)
    if hist_avg == 0:
        return None
    return ((fc_avg - hist_avg) / hist_avg) * 100.0


# ---------------------------------------------------------------------------
# Forecaster implementations. Each returns a dict with:
#   "fit"         - callable(offsets, values) -> fitted model/state
#   "predict_next"- callable(model, offsets, values) -> scalar prediction for
#                    the month immediately following the last observed offset
# ---------------------------------------------------------------------------

def _plan_linear():
    def fit(offsets, values):
        x = np.array(offsets, dtype=float).reshape(-1, 1)
        y = np.array(values, dtype=float)
        model = LinearRegression().fit(x, y)
        return {"model": model, "last_offset": offsets[-1]}

    def predict_next(state, offsets, values):
        return float(state["model"].predict([[state["last_offset"] + 1]])[0])

    return {"name": "linear_regression", "fit": fit, "predict_next": predict_next}


def _plan_random_forest():
    def fit(offsets, values):
        if len(values) < 2:
            return {"model": None, "last_value": values[-1], "last_month": offsets[-1] % 12 or 12}
        lag = np.array(values[:-1], dtype=float).reshape(-1, 1)
        month = np.array([(o % 12 or 12) for o in offsets[1:]], dtype=float).reshape(-1, 1)
        X = np.hstack([lag, month])
        y = np.array(values[1:], dtype=float)
        model = RandomForestRegressor(n_estimators=200, random_state=42, min_samples_leaf=1).fit(X, y)
        last_value = values[-1]
        last_month = offsets[-1] % 12 or 12
        return {"model": model, "last_value": last_value, "last_month": last_month}

    def predict_next(state, offsets, values):
        if state["model"] is None:
            return float(state["last_value"])
        next_month = (state["last_month"] % 12) + 1
        x = np.array([[state["last_value"], float(next_month)]])
        return float(state["model"].predict(x)[0])

    return {"name": "random_forest", "fit": fit, "predict_next": predict_next}


def _plan_arima():
    def fit(offsets, values):
        try:
            from pmdarima import auto_arima
        except Exception:
            auto_arima = None
        last_month = offsets[-1] % 12 or 12
        next_month = (last_month % 12) + 1
        if auto_arima is not None and len(values) >= 8:
            try:
                seasonal = len(values) >= 24
                m = 12 if seasonal else 1
                model = auto_arima(
                    np.asarray(values, dtype=float),
                    seasonal=seasonal,
                    m=m,
                    start_p=0, start_q=0, max_p=4, max_q=4,
                    d=0, max_d=1,
                    stepwise=True,
                    suppress_warnings=True,
                    error_action="ignore",
                    random_state=42,
                )
                return {"model": model, "next_month": next_month, "using_arima": True}
            except Exception:
                pass
        # Fallback: a naive seasonal-mean / last-value baseline when ARIMA fails.
        return {"model": None, "next_month": next_month, "using_arima": False, "last_value": values[-1]}

    def predict_next(state, offsets, values):
        if state.get("using_arima") and state["model"] is not None:
            fc = state["model"].predict(n_periods=1)
            return float(fc[0])
        return float(state.get("last_value", values[-1]))

    return {"name": "arima", "fit": fit, "predict_next": predict_next}


_MODEL_PLANS = {
    "linear_regression": _plan_linear,
    "random_forest": _plan_random_forest,
    "arima": _plan_arima,
}


def _walk_forecast(plan, offsets, values, periods):
    """Walk forward `periods` steps, refitting on the expanded window each step."""
    out = []
    cur_offsets = list(offsets)
    cur_values = list(values)
    for _ in range(periods):
        state = plan["fit"](cur_offsets, cur_values)
        pred = plan["predict_next"](state, cur_offsets, cur_values)
        pred = max(0.0, float(pred))
        out.append(pred)
        cur_values.append(pred)
        cur_offsets.append(cur_offsets[-1] + 1)
    return out


def _metrics(actual, predicted):
    a = np.asarray(actual, dtype=float)
    p = np.asarray(predicted, dtype=float)
    if len(a) == 0:
        return None
    n = len(a)
    errors = a - p
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    if np.all(a == 0) or np.mean(np.abs(a)) == 0:
        mape = None
    else:
        mape = float(np.mean(np.abs(errors) / np.abs(a)) * 100.0)
    ss_res = float(np.sum((a - p) ** 2))
    ss_tot = float(np.sum((a - np.mean(a)) ** 2))
    r2 = (1.0 - ss_res / ss_tot) if ss_tot > 0 else (1.0 if np.isclose(ss_res, 0) else 0.0)
    return {"mae": round(mae, 2), "rmse": round(rmse, 2), "mape": round(mape, 2) if mape is not None else None, "r2": round(r2, 4)}


def _best_model(offsets, values):
    """Compare the three models on a rolling holdout; return (winner_name, metrics, candidate_metrics)."""
    n = len(values)
    holdout = max(2, min(6, n // 3))
    train_n = n - holdout
    if train_n < 3:
        return "linear_regression", None, None

    train_offsets = offsets[:train_n]
    train_values = values[:train_n]
    test_offsets = offsets[train_n:]
    test_values = values[train_n:]

    candidate_metrics = {}
    results = {}
    for name, plan_factory in _MODEL_PLANS.items():
        plan = plan_factory()
        preds = _walk_forecast(plan, train_offsets, train_values, holdout)
        m = _metrics(test_values, preds)
        candidate_metrics[name] = m
        results[name] = m

    def sort_key(name):
        m = results.get(name) or {}
        return (
            m.get("rmse") if m.get("rmse") is not None else float("inf"),
            m.get("mae") if m.get("mae") is not None else float("inf"),
            m.get("mape") if m.get("mape") is not None else float("inf"),
        )

    winner = min(results.keys(), key=sort_key)
    return winner, results.get(winner), candidate_metrics


def run_forecast(municipality_id: Optional[int], period_start: date, period_end: date, forecast_horizon: int = 12):
    hist_start = period_start - timedelta(days=365 * 3)
    labels, values, offsets = _monthly_aggregates(municipality_id, hist_start, period_end)
    readiness = _readiness(labels)

    run = ForecastRun(
        municipality_id=municipality_id,
        period_start=period_start,
        period_end=period_end,
        readiness=readiness,
    )
    db.session.add(run)
    db.session.flush()

    if readiness == "not_ready" or not values or len(values) < 6:
        run.algorithm = "none"
        run.reliability = "low"
        run.trend_direction = "stable"
        run.expected_change_pct = None
        run.projected_total = None
        db.session.commit()
        return run

    winner, winner_metrics, candidate_metrics = _best_model(offsets, values)
    plan = _MODEL_PLANS[winner]()

    # Fit the winner on the full history and generate the forward forecast.
    preds = _walk_forecast(plan, offsets, values, forecast_horizon)

    # Trend direction from the winner's fitted linear trend when available.
    state = plan["fit"](offsets, values)
    if winner == "linear_regression":
        slope = float(state["model"].coef_[0])
        monthly_avg = float(np.mean(values)) if len(values) else 0.0
        slope_pct = (slope / monthly_avg * 100.0) if monthly_avg != 0 else 0.0
        trend = _trend_direction(slope_pct)
    else:
        # Approximate slope over the observed window end-to-end for labeling.
        if len(offsets) > 1:
            x0, x1 = offsets[0], offsets[-1]
            diff = offsets[-1] - offsets[0]
            slope = (values[-1] - values[0]) / diff if diff else 0.0
            monthly_avg = float(np.mean(values)) if len(values) else 0.0
            slope_pct = (slope / monthly_avg * 100.0) if monthly_avg != 0 else 0.0
            trend = _trend_direction(slope_pct)
        else:
            trend = "stable"

    # Residual-based confidence band from a linear fit over the full history.
    x_full = np.array(offsets, dtype=float).reshape(-1, 1)
    y_full = np.array(values, dtype=float)
    lin = LinearRegression().fit(x_full, y_full)
    residuals = y_full - lin.predict(x_full)
    monthly_avg = float(np.mean(y_full)) if len(y_full) else 0.0
    if len(residuals) > 1:
        std_err = float(np.std(residuals, ddof=1))
    else:
        std_err = float(np.std(y_full)) * 0.5 if len(y_full) else monthly_avg * 0.2
    std_err = max(std_err, monthly_avg * 0.05)

    last_label = labels[-1] if labels else period_start.isoformat()[:7]
    all_labels = labels + [_next_month_label(last_label, i + 1) for i in range(forecast_horizon)]
    all_values = list(values) + [max(0.0, float(v)) for v in preds]
    all_lower = [None] * len(values) + [max(0.0, float(v) - 1.65 * std_err) for v in preds]
    all_upper = [None] * len(values) + [max(0.0, float(v) + 1.65 * std_err) for v in preds]
    all_forecast = [False] * len(values) + [True] * forecast_horizon

    for i in range(len(all_labels)):
        db.session.add(ForecastPoint(
            run_id=run.id,
            period_label=all_labels[i],
            predicted_value=all_values[i],
            lower_bound=all_lower[i],
            upper_bound=all_upper[i],
            is_forecast=all_forecast[i],
        ))

    expected = _expected_change(values, list(preds))
    projected = float(sum(preds))

    run.algorithm = winner
    run.reliability = _reliability(readiness, len(values))
    run.trend_direction = trend
    run.expected_change_pct = expected
    run.projected_total = projected
    run.mae = winner_metrics["mae"] if winner_metrics and winner_metrics["mae"] is not None else None
    run.rmse = winner_metrics["rmse"] if winner_metrics and winner_metrics["rmse"] is not None else None
    run.mape = winner_metrics["mape"] if winner_metrics and winner_metrics["mape"] is not None else None
    run.r2 = winner_metrics["r2"] if winner_metrics and winner_metrics["r2"] is not None else None
    run.candidate_metrics = candidate_metrics
    db.session.commit()
    return run


def _next_month_label(current_ym: str, offset: int) -> str:
    y, m = int(current_ym[:4]), int(current_ym[5:7])
    m += offset
    while m > 12:
        m -= 12
        y += 1
    while m < 1:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


def get_municipality_outlook():
    municipalities = Municipality.query.filter_by(status="active").order_by(Municipality.name).all()
    results = []
    for m in municipalities:
        latest_run = (
            ForecastRun.query.filter_by(municipality_id=m.id)
            .order_by(ForecastRun.created_at.desc())
            .first()
        )
        if latest_run:
            results.append({
                "municipality_id": m.id,
                "municipality_name": m.name,
                "trend_direction": latest_run.trend_direction,
                "expected_change_pct": float(latest_run.expected_change_pct) if latest_run.expected_change_pct is not None else None,
                "readiness": latest_run.readiness,
                "reliability": latest_run.reliability,
                "algorithm": latest_run.algorithm,
                "last_run_at": latest_run.created_at.isoformat() + "Z" if latest_run.created_at else None,
            })
        else:
            labels, values, offsets = _monthly_aggregates(m.id, date(2020, 1, 1), date.today())
            readiness = _readiness(labels)
            results.append({
                "municipality_id": m.id,
                "municipality_name": m.name,
                "trend_direction": "stable",
                "expected_change_pct": None,
                "readiness": readiness,
                "reliability": _reliability(readiness, len(labels)),
                "algorithm": None,
                "last_run_at": None,
            })
    return results
