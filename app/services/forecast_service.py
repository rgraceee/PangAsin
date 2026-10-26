# WHAT: Core forecasting logic (monthly aggregation, model fitting, forecast run,
#       outlook, target evaluation).
# WHY: Hiwalay sa API layer para ma-test/ma-reuse ang parehong Math kahit saan.
from datetime import date, timedelta
from typing import List, Optional, Tuple

import numpy as np
import warnings
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor

from app.extensions import db
from app.models.forecast import ForecastRun, ForecastPoint
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality
from app.services.aggregates import (
    _monthly_aggregates,
    _reindex_complete,
    _last_month_with_data,
)
from sqlalchemy import func

# Reference epoch for computing real (non-compressed) month positions.
_EPOCH_YEAR = 2000
_EPOCH_MONTH = 1


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


def _trend_direction(change_pct: Optional[float]) -> str:
    """Direction from ONE function: Expected change ("Forecast vs recent
    average") with +2% / -2% thresholds. Used by the bars, the Needs-attention
    list and the summary table so Direction never disagrees with the headline
    number (fixes the Infanta case where +30.6% was shown as Declining)."""
    if change_pct is None:
        return "stable"
    if change_pct > 2:
        return "increasing"
    if change_pct < -2:
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


def _plan_sarimax():
    """SARIMAX candidate model.

    Seasonal period m=12 only when the series has at least 24 months;
    otherwise non-seasonal orders are used. Small grid search capped at
    about 16 fits, picked by AIC. enforce_stationarity and
    enforce_invertibility are both False. Convergence warnings are
    suppressed and failed fits are skipped.
    """
    plan = {
        "name": "sarimax",
        "fit": None,
        "predict_next": None,
        "order": None,
        "seasonal_order": None,
    }

    def fit(offsets, values):
        try:
            from statsmodels.tsa.statespace.sarimax import SARIMAX
        except Exception:
            plan["order"] = None
            plan["seasonal_order"] = None
            return {
                "model": None,
                "using_sarimax": False,
                "last_value": values[-1] if values else 0.0,
            }

        if len(values) < 24:
            plan["order"] = None
            plan["seasonal_order"] = None
            return {
                "model": None,
                "using_sarimax": False,
                "last_value": values[-1] if values else 0.0,
            }

        seasonal = len(values) >= 24
        m = 12 if seasonal else 1
        max_d_seasonal = 0 if len(values) < 36 else 1

        y = np.asarray(values, dtype=float)
        best_aic = float("inf")
        best_result = None
        best_order = None
        best_seasonal_order = None
        fits = 0
        max_fits = 16

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for p in (0, 1):
                for d in (0, 1):
                    for q in (0, 1):
                        for P in (0, 1):
                            seasonal_Ds = (0,) if max_d_seasonal == 0 else (0, 1)
                            for D in seasonal_Ds:
                                for Q in (0, 1):
                                    if fits >= max_fits:
                                        break
                                    if not seasonal and (P or D or Q):
                                        continue
                                    try:
                                        model = SARIMAX(
                                            y,
                                            order=(p, d, q),
                                            seasonal_order=(P, D, Q, m),
                                            enforce_stationarity=False,
                                            enforce_invertibility=False,
                                        )
                                        result = model.fit(disp=False)
                                        fits += 1
                                        aic = float(result.aic)
                                        if aic < best_aic:
                                            best_aic = aic
                                            best_result = result
                                            best_order = (p, d, q)
                                            best_seasonal_order = (P, D, Q, m)
                                    except Exception:
                                        continue

        plan["order"] = list(best_order) if best_order is not None else None
        plan["seasonal_order"] = list(best_seasonal_order) if best_seasonal_order is not None else None

        if best_result is None:
            return {
                "model": None,
                "using_sarimax": False,
                "last_value": values[-1] if values else 0.0,
            }

        return {
            "model": best_result,
            "using_sarimax": True,
            "order": list(best_order),
            "seasonal_order": list(best_seasonal_order),
            "aic": best_aic,
        }

    def predict_next(state, offsets, values):
        if not state.get("using_sarimax") or state["model"] is None:
            return float(state.get("last_value", values[-1] if values else 0.0))
        try:
            fc = state["model"].get_forecast(steps=1)
            return float(fc.predicted_mean[0])
        except Exception:
            return float(state.get("last_value", values[-1] if values else 0.0))

    plan["fit"] = fit
    plan["predict_next"] = predict_next
    return plan


_MODEL_PLANS = {
    "linear_regression": _plan_linear,
    "random_forest": _plan_random_forest,
    "arima": _plan_arima,
    "sarimax": _plan_sarimax,
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
        mape = min(mape, 100000.0)
    ss_res = float(np.sum((a - p) ** 2))
    ss_tot = float(np.sum((a - np.mean(a)) ** 2))
    r2 = (1.0 - ss_res / ss_tot) if ss_tot > 0 else (1.0 if np.isclose(ss_res, 0) else 0.0)
    r2 = max(r2, -1000000.0)
    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "mape": round(mape, 2) if mape is not None else None,
        "r2": round(r2, 4),
    }


def _best_model(offsets, values):
    """Compare the models on a rolling holdout; return (winner_name, metrics, candidate_metrics).

    candidate_metrics includes the model's orders for SARIMAX (e.g. "order" and
    "seasonal_order") so they can be stored and reported.
    """
    n = len(values)
    holdout = max(2, min(6, n // 3))
    train_n = n - holdout
    if train_n < 3:
        return "linear_regression", None, None

    train_offsets = offsets[:train_n]
    train_values = values[:train_n]
    test_values = values[train_n:]

    candidate_metrics = {}
    results = {}
    for name, plan_factory in _MODEL_PLANS.items():
        plan = plan_factory()
        preds = _walk_forecast(plan, train_offsets, train_values, holdout)
        m = _metrics(test_values, preds)
        if name == "sarimax":
            m = dict(m) if m else {}
            if plan.get("order") is not None:
                m["order"] = plan["order"]
            if plan.get("seasonal_order") is not None:
                m["seasonal_order"] = plan["seasonal_order"]
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


# ---------------------------------------------------------------------------
# Incomplete-tail detection and seasonal anchoring (no hardcoded years).
# ---------------------------------------------------------------------------

def _detect_incomplete_tail(labels, values):
    """Return whether the latest in-progress year is under-reported.

    Anchor on the latest fully reported year (a year with at least 10 months of
    approved records). Flag the tail as incomplete when the latest year's same
    months fall below 30% of the anchor year's same months.

    Returns (flag, affected_tail_positions) where positions are measured from
    the end of the series (0 = last month).
    """
    if not labels or not values:
        return False, []

    # Group values by year -> {month: value}
    year_months = {}
    for lb, v in zip(labels, values):
        year = int(lb[:4])
        month = int(lb[5:7])
        year_months.setdefault(year, {})[month] = v

    if not year_months:
        return False, []

    years = sorted(year_months.keys())

    # Anchor: latest year with at least 10 months of data.
    anchor_year = None
    for y in reversed(years):
        if len(year_months[y]) >= 10:
            anchor_year = y
            break

    if anchor_year is None:
        return False, []

    latest_year = years[-1]

    # If the latest year IS the anchor year, it is fully reported.
    if latest_year == anchor_year:
        return False, []

    anchor_data = year_months[anchor_year]
    latest_data = year_months[latest_year]
    productive_months = {m for m, v in anchor_data.items() if v is not None and v > 0}

    below = []
    for month, v in latest_data.items():
        # Missing months (None) are skipped — never treated as zero production.
        if v is None:
            continue
        anchor_val = anchor_data.get(month)
        if anchor_val is not None and anchor_val > 0 and v < 0.30 * anchor_val:
            if month in productive_months:
                below.append(month)

    if not below:
        return False, []

    positions = [
        len(labels) - 1 - i
        for i, lb in enumerate(reversed(labels))
        if int(lb[:4]) == latest_year
    ]
    return True, positions


def _seasonal_profile(labels, values, anchor_year):
    """Per-month-of-year mean volumes for the given anchor year.

    Missing months (None) are excluded.
    """
    profile = {}
    for lb, v in zip(labels, values):
        if v is None:
            continue
        month = int(lb[5:7])
        year = int(lb[:4])
        if year != anchor_year:
            continue
        profile.setdefault(month, []).append(float(v))
    if not profile:
        return None
    return {m: float(sum(vs)) / len(vs) for m, vs in profile.items()}


def _find_anchor_year(labels, values):
    """Find the latest year with at least 10 months of approved records."""
    if not labels:
        return None
    year_counts = {}
    for lb in labels:
        y = int(lb[:4])
        year_counts[y] = year_counts.get(y, 0) + 1
    for y in sorted(year_counts.keys(), reverse=True):
        if year_counts[y] >= 10:
            return y
    return None


def _forecast_anchored(labels, values, forecast_horizon: int = 12):
    """Produce a projection anchored to the latest fully reported year's seasonal
    profile. Falls back to the recent average when no complete year exists.

    Missing months are None (never zeros); they are excluded from averages.
    """
    anchor_year = _find_anchor_year(labels, values)
    note = ""
    observed = [v for v in values if v is not None]
    flat_past = sum(observed) / len(observed) if observed else 0.0

    if anchor_year is not None:
        profile = _seasonal_profile(labels, values, anchor_year)
        if profile:
            last_label = labels[-1]
            preds = []
            for i in range(1, forecast_horizon + 1):
                nl = _next_month_label(last_label, i)
                month = int(nl[5:7])
                val = profile.get(month, flat_past)
                preds.append(max(0.0, float(val)))
            note = (
                "Recent months appear partially reported (year in progress). "
                f"Forecast anchored to the {anchor_year} seasonal production pattern."
            )
            return preds, note

    preds = [flat_past] * forecast_horizon
    note = "Forecast anchored to the recent average production level."
    return preds, note


def _non_nan_pairs(offsets: List[int], values: List[Optional[float]]) -> Tuple[List[int], List[float]]:
    """Return (offsets, values) with NaN / None months removed.

    Some models (linear regression, random forest) cannot consume missing
    months; SARIMAX can handle them internally. Callers that need a fully
    observed series drop the gaps here so missing months are never treated as
    zeros.
    """
    clean_offsets = []
    clean_values = []
    for off, val in zip(offsets, values):
        if val is None:
            continue
        clean_offsets.append(off)
        clean_values.append(float(val))
    return clean_offsets, clean_values


def _backtest(plan, offsets, values, holdout: int) -> List[dict]:
    """Produce [{period_label, actual, predicted}] for the holdout months.

    Walks forward one step at a time over the holdout window, refitting on the
    expanding observed window each step. Missing months are NaN-safe.
    """
    n = len(values)
    train_n = n - holdout
    if train_n < 3:
        return []
    train_offsets = offsets[:train_n]
    train_values = values[:train_n]
    test_offsets = offsets[train_n:]
    test_values = values[train_n:]

    results = []
    cur_offsets = list(train_offsets)
    cur_values = list(train_values)
    for i in range(len(test_offsets)):
        clean_off, clean_val = _non_nan_pairs(cur_offsets, cur_values)
        if len(clean_val) < 3:
            break
        state = _MODEL_PLANS[plan] if isinstance(plan, str) else plan
        plan_factory = state if callable(state) else _MODEL_PLANS.get(state)
        if plan_factory is None:
            break
        pl = plan_factory()
        fit_state = pl["fit"](clean_off, clean_val)
        pred = pl["predict_next"](fit_state, clean_off, clean_val)
        pred = max(0.0, float(pred))
        actual = test_values[i]
        results.append({
            "period_label": _label_from_offset(test_offsets[i]),
            "actual": None if actual is None else round(float(actual), 3),
            "predicted": round(pred, 3),
        })
        cur_values.append(test_values[i] if test_values[i] is not None else pred)
        cur_offsets.append(test_offsets[i])
    return results


def _label_from_offset(offset: int) -> str:
    total_months = offset
    y = _EPOCH_YEAR + total_months // 12
    m = (total_months % 12) + 1
    return f"{y:04d}-{m:02d}"


# ---------------------------------------------------------------------------
# Forecast run entry point.
# ---------------------------------------------------------------------------

def run_forecast(municipality_id: Optional[int] = None, forecast_horizon: int = 12):
    # WHAT: Generate at i-save ang isang ForecastRun gamit ang pinakamagandang model.
    # WHY: Ito ang tawab ng /forecast/run. Ang history window ay awtomatikong
    #      itinataas (huling 3 taon bago ang huling buwan may data) at ang
    #      forecast ay 12 buwan sa hinaharap mula sa huling buwan may data.
    #      Hindi na kailangang mag-input ng period_start / period_end.
    forecast_horizon = max(1, min(36, int(forecast_horizon or 12)))

    # Auto history window: last 3 years up to the last month with data.
    last_ym = _last_month_with_data(municipality_id)
    if last_ym is None:
        # No approved data at all for this scope.
        run = ForecastRun(
            municipality_id=municipality_id,
            period_start=date.today().replace(day=1),
            period_end=date.today().replace(day=1),
            readiness="not_ready",
        )
        db.session.add(run)
        db.session.flush()
        run.algorithm = "none"
        run.reliability = "low"
        run.trend_direction = "stable"
        run.expected_change_pct = None
        run.projected_total = None
        run.candidate_metrics = None
        run.model_comparison = None
        run.backtest = None
        run.note = "No approved production data available for this scope."
        db.session.commit()
        return run

    ly, lm = int(last_ym[:4]), int(last_ym[5:7])
    period_end = date(ly, lm, 1)
    period_start = date(ly - 3, lm, 1)

    labels, values, offsets = _monthly_aggregates(municipality_id, period_start, period_end)
    # Complete monthly index; missing months are None (never zeros).
    complete_labels, complete_values, complete_offsets = _reindex_complete(
        labels, values, offsets, period_start.isoformat()[:7], last_ym)

    observed = [v for v in complete_values if v is not None]
    readiness = _readiness(observed)

    run = ForecastRun(
        municipality_id=municipality_id,
        period_start=period_start,
        period_end=period_end,
        readiness=readiness,
    )
    db.session.add(run)
    db.session.flush()

    # Work with the observed (non-NaN) series for modeling; gaps stay gaps.
    obs_offsets, obs_values = _non_nan_pairs(complete_offsets, complete_values)

    if readiness == "not_ready" or not obs_values or len(obs_values) < 6:
        run.algorithm = "none"
        run.reliability = "low"
        run.trend_direction = "stable"
        run.expected_change_pct = None
        run.projected_total = None
        run.candidate_metrics = None
        run.model_comparison = None
        run.backtest = None
        run.note = "Insufficient data to forecast (need at least 6 observed months)."
        db.session.commit()
        return run

    incomplete, tail_positions = _detect_incomplete_tail(complete_labels, complete_values)

    last_label = complete_labels[-1] if complete_labels else last_ym
    all_labels = complete_labels + [_next_month_label(last_label, i + 1) for i in range(forecast_horizon)]
    note = None

    sarimax_state = None
    sarimax_lower = None
    sarimax_upper = None

    candidate_metrics = None
    winner_metrics = None
    algorithm = "none"
    preds = []

    if incomplete:
        preds, note = _forecast_anchored(complete_labels, complete_values, forecast_horizon)
        algorithm = "seasonal_baseline"
        winner_metrics = None
    else:
        winner, winner_metrics, candidate_metrics = _best_model(obs_offsets, obs_values)
        algorithm = winner

        if algorithm == "sarimax":
            plan = _MODEL_PLANS["sarimax"]()
            sarimax_state = plan["fit"](obs_offsets, obs_values)
            if sarimax_state.get("using_sarimax") and sarimax_state["model"] is not None:
                try:
                    fc = sarimax_state["model"].get_forecast(steps=forecast_horizon)
                    preds = [max(0.0, float(v)) for v in fc.predicted_mean]
                    conf = fc.conf_int(alpha=0.10)
                    conf_vals = conf.values if hasattr(conf, "values") else conf
                    sarimax_lower = [max(0.0, float(row[0])) for row in conf_vals]
                    sarimax_upper = [max(0.0, float(row[1])) for row in conf_vals]
                except Exception:
                    sarimax_state = None
                    preds = _walk_forecast(
                        _MODEL_PLANS["linear_regression"](), obs_offsets, obs_values, forecast_horizon
                    )
                    algorithm = "linear_regression"
            else:
                sarimax_state = None
                preds = _walk_forecast(
                    _MODEL_PLANS["linear_regression"](), obs_offsets, obs_values, forecast_horizon
                )
                algorithm = "linear_regression"
        else:
            plan = _MODEL_PLANS[algorithm]()
            preds = _walk_forecast(plan, obs_offsets, obs_values, forecast_horizon)

    # Backtest (accuracy check) for the chosen model's holdout months.
    backtest = None
    if not incomplete and winner_metrics is not None:
        holdout = max(2, min(6, len(obs_values) // 3))
        if len(obs_values) - holdout >= 3:
            backtest = _backtest(algorithm, obs_offsets, obs_values, holdout)

    expected = _expected_change(obs_values, list(preds))

    # Direction comes from ONE function: Expected change ("Forecast vs recent
    # average") with +2% / -2% thresholds. Used by bars, Needs-attention list
    # and the summary table so Direction never disagrees with the headline number
    # (fixes the Infanta case where +30.6% was shown as Declining).
    trend = _trend_direction(expected)


    # Confidence band.
    # History values aligned to the complete monthly index: missing months are
    # stored as NULL (never zeros / never invented).
    history_values = [float(v) if v is not None else None for v in complete_values]
    n_hist = len(complete_labels)

    if sarimax_state is not None and sarimax_lower is not None and sarimax_upper is not None:
        all_lower = [None] * n_hist + sarimax_lower
        all_upper = [None] * n_hist + sarimax_upper
    else:
        x_full = np.array(obs_offsets, dtype=float).reshape(-1, 1)
        y_full = np.array(obs_values, dtype=float)
        lin = LinearRegression().fit(x_full, y_full)
        residuals = y_full - lin.predict(x_full)
        monthly_avg = float(np.mean(y_full)) if len(y_full) else 0.0
        if len(residuals) > 1:
            std_err = float(np.std(residuals, ddof=1))
        else:
            std_err = float(np.std(y_full)) * 0.5 if len(y_full) else monthly_avg * 0.2
        std_err = max(std_err, monthly_avg * 0.05)
        all_lower = [None] * n_hist + [max(0.0, float(v) - 1.65 * std_err) for v in preds]
        all_upper = [None] * n_hist + [max(0.0, float(v) + 1.65 * std_err) for v in preds]

    all_values = history_values + [max(0.0, float(v)) for v in preds]
    all_forecast = [False] * n_hist + [True] * forecast_horizon

    # If the residual-based band collapsed to zero for any forecast point
    # (common with seasonal data fit to a linear model), replace that point's
    # band with a percentage-based band (±15%) so the expected range never
    # shows 0 when the forecast is substantial.
    for i in range(n_hist, len(all_lower)):
        if all_lower[i] is not None and all_lower[i] == 0.0 and all_values[i] > 0:
            all_lower[i] = max(0.0, all_values[i] * 0.85)
            all_upper[i] = all_values[i] * 1.15

    for i in range(len(all_labels)):
        db.session.add(ForecastPoint(
            run_id=run.id,
            period_label=all_labels[i],
            predicted_value=all_values[i],
            lower_bound=all_lower[i],
            upper_bound=all_upper[i],
            is_forecast=all_forecast[i],
        ))

    projected = float(sum(preds))

    # Build model_comparison from candidate_metrics.
    model_comparison = None
    if candidate_metrics:
        chosen = algorithm
        comparison = []
        for algo, m in candidate_metrics.items():
            comparison.append({
                "algorithm": algo,
                "rmse": m.get("rmse") if isinstance(m, dict) else None,
                "mae": m.get("mae") if isinstance(m, dict) else None,
                "mape": m.get("mape") if isinstance(m, dict) else None,
                "chosen": algo == chosen,
            })
        comparison.sort(key=lambda x: x["rmse"] if x["rmse"] is not None else float("inf"))
        model_comparison = comparison

    run.algorithm = algorithm
    run.reliability = _reliability(readiness, len(obs_values)) if not incomplete else "moderate"
    run.trend_direction = trend
    run.expected_change_pct = expected
    run.projected_total = projected
    run.mae = winner_metrics["mae"] if winner_metrics and winner_metrics.get("mae") is not None else None
    run.rmse = winner_metrics["rmse"] if winner_metrics and winner_metrics.get("rmse") is not None else None
    run.mape = winner_metrics["mape"] if winner_metrics and winner_metrics.get("mape") is not None else None
    run.r2 = winner_metrics["r2"] if winner_metrics and winner_metrics.get("r2") is not None else None
    run.candidate_metrics = candidate_metrics
    run.note = note if note else None
    run.incomplete_tail = incomplete
    run.backtest = backtest
    db.session.commit()
    return run


def run_forecast_all_municipalities(forecast_horizon: int = 12):
    # WHAT: Build an all-municipalities forecast by summing each active
    #       municipality's monthly predictions. Band = root-sum-square of the
    #       per-municipality half-widths (clamped at 0). Stored as one
    #       all-municipalities run so the municipality forecast summary works.
    # WHY: Province total is the sum of municipality forecasts, never a separate
    #      province-level model.
    forecast_horizon = max(1, min(36, int(forecast_horizon or 12)))
    from app.models.municipality import Municipality
    municipalities = Municipality.query.filter_by(status="active").order_by(Municipality.name).all()

    # Collect per-municipality forecasts (reuse latest run if available, else run).
    month_preds: dict = {}   # label -> [values]
    month_lower: dict = {}
    month_upper: dict = {}
    methods = {}
    any_ready = False
    for m in municipalities:
        latest = (
            ForecastRun.query.filter_by(municipality_id=m.id)
            .order_by(ForecastRun.created_at.desc())
            .first()
        )
        if latest and latest.points and any(p.is_forecast for p in latest.points):
            pts = sorted([p for p in latest.points if p.is_forecast], key=lambda p: p.period_label)
            for p in pts[:forecast_horizon]:
                month_preds.setdefault(p.period_label, []).append(float(p.predicted_value or 0))
                if p.lower_bound is not None and p.upper_bound is not None:
                    month_lower.setdefault(p.period_label, []).append(float(p.upper_bound) - float(p.predicted_value or 0))
                    month_upper.setdefault(p.period_label, []).append(float(p.upper_bound) - float(p.predicted_value or 0))
            methods[m.id] = latest.algorithm
            if latest.algorithm != "none":
                any_ready = True
        else:
            run_m = run_forecast(m.id, forecast_horizon)
            for p in run_m.points:
                if p.is_forecast:
                    month_preds.setdefault(p.period_label, []).append(float(p.predicted_value or 0))
                    if p.lower_bound is not None and p.upper_bound is not None:
                        month_lower.setdefault(p.period_label, []).append(float(p.upper_bound) - float(p.predicted_value or 0))
                        month_upper.setdefault(p.period_label, []).append(float(p.upper_bound) - float(p.predicted_value or 0))
            methods[m.id] = run_m.algorithm
            if run_m.algorithm != "none":
                any_ready = True

    if not any_ready or not month_preds:
        # No data anywhere: create an empty all-municipalities run.
        run = ForecastRun(
            municipality_id=None,
            period_start=date.today().replace(day=1),
            period_end=date.today().replace(day=1),
            readiness="not_ready",
        )
        db.session.add(run)
        db.session.flush()
        run.algorithm = "none"
        run.reliability = "low"
        run.trend_direction = "stable"
        run.expected_change_pct = None
        run.projected_total = None
        run.candidate_metrics = None
        run.model_comparison = None
        run.backtest = None
        run.note = "No approved production data available for any municipality."
        db.session.commit()
        return run

    all_labels = sorted(month_preds.keys())[:forecast_horizon]
    all_values = [sum(month_preds[l]) for l in all_labels]

    # Root-sum-square of half-widths, clamped at 0.
    all_lower = []
    all_upper = []
    for l in all_labels:
        lowers = month_lower.get(l, [])
        uppers = month_upper.get(l, [])
        if lowers and uppers:
            rss_hi = sum(h * h for h in uppers) ** 0.5
            rss_lo = sum(h * h for h in lowers) ** 0.5
            all_lower.append(max(0.0, all_values[all_labels.index(l)] - rss_lo))
            all_upper.append(max(0.0, all_values[all_labels.index(l)] + rss_hi))
        else:
            all_lower.append(None)
            all_upper.append(None)

    all_forecast = [True] * len(all_labels)

    # Compute weighted-average expected change across municipalities so the
    # all-municipalities run has a meaningful direction instead of hardcoded
    # "stable". Weights are per-municipality projected totals.
    total_weighted_change = 0.0
    total_weight = 0.0
    for m in municipalities:
        latest_m = (
            ForecastRun.query.filter_by(municipality_id=m.id)
            .order_by(ForecastRun.created_at.desc())
            .first()
        )
        if latest_m and latest_m.expected_change_pct is not None and latest_m.projected_total is not None:
            w = float(latest_m.projected_total)
            if w > 0:
                total_weighted_change += float(latest_m.expected_change_pct) * w
                total_weight += w
    all_expected_change = (total_weighted_change / total_weight) if total_weight > 0 else None

    run = ForecastRun(
        municipality_id=None,
        period_start=all_labels[0] and date(int(all_labels[0][:4]), int(all_labels[0][5:7]), 1),
        period_end=date(int(all_labels[-1][:4]), int(all_labels[-1][5:7]), 1),
        readiness="ready" if any_ready else "not_ready",
    )
    db.session.add(run)
    db.session.flush()
    for i in range(len(all_labels)):
        db.session.add(ForecastPoint(
            run_id=run.id,
            period_label=all_labels[i],
            predicted_value=all_values[i],
            lower_bound=all_lower[i],
            upper_bound=all_upper[i],
            is_forecast=all_forecast[i],
        ))
    run.algorithm = "seasonal_baseline"
    run.reliability = "moderate" if any_ready else "low"
    run.trend_direction = _trend_direction(all_expected_change)
    run.expected_change_pct = all_expected_change
    run.projected_total = float(sum(all_values))
    run.candidate_metrics = None
    run.model_comparison = None
    run.backtest = None
    run.note = "Province total = sum of municipality forecasts; band = root-sum-square of per-municipality half-widths."
    db.session.commit()
    return run

    incomplete, tail_positions = _detect_incomplete_tail(labels, values)

    last_label = labels[-1] if labels else period_start.isoformat()[:7]
    all_labels = labels + [_next_month_label(last_label, i + 1) for i in range(forecast_horizon)]
    note = None

    sarimax_state = None
    sarimax_lower = None
    sarimax_upper = None

    if incomplete:
        # Prior months complete, but the trailing ones collapsed (mid-year
        # partial reporting). Anchor the projection to the established seasonal
        # pattern so it does not forecast a false collapse.
        preds, note = _forecast_anchored(labels, values, forecast_horizon)
        algorithm = "seasonal_anchor"
        winner_metrics = None
        candidate_metrics = None
    else:
        winner, winner_metrics, candidate_metrics = _best_model(offsets, values)
        algorithm = winner

        if algorithm == "sarimax":
            plan = _MODEL_PLANS["sarimax"]()
            sarimax_state = plan["fit"](offsets, values)
            if sarimax_state.get("using_sarimax") and sarimax_state["model"] is not None:
                try:
                    fc = sarimax_state["model"].get_forecast(steps=forecast_horizon)
                    preds = [max(0.0, float(v)) for v in fc.predicted_mean]
                    conf = fc.conf_int(alpha=0.10)
                    conf_vals = conf.values if hasattr(conf, "values") else conf
                    sarimax_lower = [max(0.0, float(row[0])) for row in conf_vals]
                    sarimax_upper = [max(0.0, float(row[1])) for row in conf_vals]
                except Exception:
                    sarimax_state = None
                    preds = _walk_forecast(
                        _MODEL_PLANS["linear_regression"](), offsets, values, forecast_horizon
                    )
                    algorithm = "linear_regression"
            else:
                # SARIMAX could not be fitted; fall back silently to linear.
                sarimax_state = None
                preds = _walk_forecast(
                    _MODEL_PLANS["linear_regression"](), offsets, values, forecast_horizon
                )
                algorithm = "linear_regression"
        else:
            plan = _MODEL_PLANS[algorithm]()
            preds = _walk_forecast(plan, offsets, values, forecast_horizon)

    # Trend direction from the winner's fitted linear trend when available.
    state = None
    if not incomplete and algorithm == "linear_regression":
        plan = _MODEL_PLANS["linear_regression"]()
        state = plan["fit"](offsets, values)

    if algorithm == "linear_regression" and state is not None:
        slope = float(state["model"].coef_[0])
        monthly_avg = float(np.mean(values)) if len(values) else 0.0
        slope_pct = (slope / monthly_avg * 100.0) if monthly_avg != 0 else 0.0
        trend = _trend_direction(slope_pct)
    else:
        # Approximate slope over the observed window end-to-end for labeling.
        if len(offsets) > 1:
            diff = offsets[-1] - offsets[0]
            slope = (values[-1] - values[0]) / diff if diff else 0.0
            monthly_avg = float(np.mean(values)) if len(values) else 0.0
            slope_pct = (slope / monthly_avg * 100.0) if monthly_avg != 0 else 0.0
            trend = _trend_direction(slope_pct)
        else:
            trend = "stable"

    # Confidence band.
    if sarimax_state is not None and sarimax_lower is not None and sarimax_upper is not None:
        # Use SARIMAX's own confidence interval.
        all_lower = [None] * len(values) + sarimax_lower
        all_upper = [None] * len(values) + sarimax_upper
    else:
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

        all_lower = [None] * len(values) + [max(0.0, float(v) - 1.65 * std_err) for v in preds]
        all_upper = [None] * len(values) + [max(0.0, float(v) + 1.65 * std_err) for v in preds]

    all_values = list(values) + [max(0.0, float(v)) for v in preds]
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

    # Build model_comparison from candidate_metrics.
    model_comparison = None
    if candidate_metrics:
        chosen = algorithm
        comparison = []
        for algo, m in candidate_metrics.items():
            comparison.append({
                "algorithm": algo,
                "rmse": m.get("rmse") if isinstance(m, dict) else None,
                "mae": m.get("mae") if isinstance(m, dict) else None,
                "mape": m.get("mape") if isinstance(m, dict) else None,
                "chosen": algo == chosen,
            })
        comparison.sort(key=lambda x: x["rmse"] if x["rmse"] is not None else float("inf"))
        model_comparison = comparison

    run.algorithm = algorithm
    run.reliability = _reliability(readiness, len(values)) if not incomplete else "moderate"
    run.trend_direction = trend
    run.expected_change_pct = expected
    run.projected_total = projected
    run.mae = winner_metrics["mae"] if winner_metrics and winner_metrics.get("mae") is not None else None
    run.rmse = winner_metrics["rmse"] if winner_metrics and winner_metrics.get("rmse") is not None else None
    run.mape = winner_metrics["mape"] if winner_metrics and winner_metrics.get("mape") is not None else None
    run.r2 = winner_metrics["r2"] if winner_metrics and winner_metrics.get("r2") is not None else None
    run.candidate_metrics = candidate_metrics
    run.note = note if note else None
    run.incomplete_tail = incomplete
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
                "trend_direction": _trend_direction(latest_run.expected_change_pct),
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


# ---------------------------------------------------------------------------
# Seasonal weight derivation (data-driven, with hardcoded fallback).
# ---------------------------------------------------------------------------

def _derive_seasonal_weights(municipality_id: Optional[int]):
    """Derive monthly target weights from the historical monthly profile of the
    selected scope.

    Returns (weights, source) where weights is a list of 12 normalized weights
    summing to 1, and source is "data" (derived from >= 2 complete years) or
    "default" (hardcoded fallback when fewer than 2 complete years exist).
    """
    DEFAULT_WEIGHTS = [
        0.10,  # Jan
        0.085,  # Feb
        0.125,  # Mar
        0.135,  # Apr
        0.125,  # May
        0.07,   # Jun
        0.055,  # Jul
        0.05,   # Aug
        0.05,   # Sep
        0.055,  # Oct
        0.06,   # Nov
        0.09,   # Dec
    ]

    hist_start = date(2020, 1, 1)
    hist_end = date.today()
    labels, values, _ = _monthly_aggregates(municipality_id, hist_start, hist_end)

    if not labels:
        return [w / sum(DEFAULT_WEIGHTS) for w in DEFAULT_WEIGHTS], "default"

    # Count months per year; a "complete" year has at least 10 months.
    year_month_counts = {}
    for lb in labels:
        y = int(lb[:4])
        year_month_counts[y] = year_month_counts.get(y, 0) + 1
    complete_years = [y for y, c in year_month_counts.items() if c >= 10]

    if len(complete_years) < 2:
        return [w / sum(DEFAULT_WEIGHTS) for w in DEFAULT_WEIGHTS], "default"

    # Average share per calendar month across complete years.
    month_totals = {m: 0.0 for m in range(1, 13)}
    month_counts = {m: 0 for m in range(1, 13)}
    for lb, v in zip(labels, values):
        y = int(lb[:4])
        m = int(lb[5:7])
        if y in complete_years:
            month_totals[m] += v
            month_counts[m] += 1

    month_avgs = {}
    for m in range(1, 13):
        month_avgs[m] = (month_totals[m] / month_counts[m]) if month_counts[m] > 0 else 0.0

    total = sum(month_avgs.values())
    if total <= 0:
        return [w / sum(DEFAULT_WEIGHTS) for w in DEFAULT_WEIGHTS], "default"

    weights = [month_avgs[m] / total for m in range(1, 13)]
    return weights, "data"


def _complete_years_with_data(municipality_id: Optional[int] = None) -> List[int]:
    """Calendar years that have at least 10 months of approved records.

    Same "complete year" convention used for the seasonal weights, so the
    historical share and the monthly target come from the same population.
    """
    labels, _, _ = _monthly_aggregates(municipality_id, date(2000, 1, 1), date.today())
    counts: dict = {}
    for lb in labels:
        y = int(lb[:4])
        counts[y] = counts.get(y, 0) + 1
    return sorted(y for y, c in counts.items() if c >= 10)


def _approved_production_by_municipality(years: List[int]) -> dict:
    """Approved production per municipality over the given complete years."""
    if not years:
        return {}
    start = date(min(years), 1, 1)
    end = date(max(years), 12, 31)
    rows = (
        db.session.query(
            ProductionRecord.municipality_id,
            func.sum(ProductionRecord.production_volume_mt).label("v"),
        )
        .filter(ProductionRecord.status == "approved")
        .filter(ProductionRecord.record_date >= start)
        .filter(ProductionRecord.record_date <= end)
        .group_by(ProductionRecord.municipality_id)
        .all()
    )
    return {r.municipality_id: float(r.v or 0) for r in rows}


def _municipality_target_breakdown(
    annual_target: float,
    weights: List[float],
    horizon: int,
) -> List[dict]:
    """Per-municipality forecast against its historical-share target share.

    Read-only: it reads the newest EXISTING run of every municipality and
    never creates a run. A municipality whose newest run covers fewer than 12
    forecast months is compared only against the target share of the same
    months, and is flagged with "months_covered". A municipality without any
    forecast run comes back with forecast_mt = None ("No data"), never zero.
    """
    municipalities = Municipality.query.filter_by(status="active").order_by(Municipality.name).all()
    if not municipalities:
        return []

    # 1) Newest existing run per municipality (no new runs are created).
    latest_run_id: dict = {}
    for run in (
        ForecastRun.query.filter(ForecastRun.municipality_id.isnot(None))
        .order_by(ForecastRun.created_at.desc())
        .all()
    ):
        if run.municipality_id not in latest_run_id:
            latest_run_id[run.municipality_id] = run.id

    # 2) Forecast points of those runs, in one query.
    points_by_run: dict = {}
    if latest_run_id:
        points = (
            db.session.query(ForecastPoint)
            .filter(ForecastPoint.run_id.in_(list(latest_run_id.values())))
            .filter(ForecastPoint.is_forecast.is_(True))
            .all()
        )
        for p in points:
            points_by_run.setdefault(p.run_id, []).append(p)

    # 3) Historical share of approved production over the complete years.
    complete_years = _complete_years_with_data(None)
    historical = _approved_production_by_municipality(complete_years)
    historical_total = sum(historical.values())

    rows = []
    for m in municipalities:
        run_id = latest_run_id.get(m.id)
        pts = sorted(points_by_run.get(run_id, []), key=lambda p: p.period_label)[:horizon]
        hist_mt = historical.get(m.id, 0.0)
        share = (hist_mt / historical_total) if historical_total > 0 else 0.0
        entry = {
            "municipality_id": m.id,
            "name": m.name,
            "historical_share": share,
            "historical_mt": hist_mt,
            "months_covered": 0,
            "forecast_mt": None,
            "target_share_mt": None,
            "months_label": None,
        }
        if pts:
            covered_months = []
            for p in pts:
                try:
                    covered_months.append(int(p.period_label[5:7]))
                except (ValueError, IndexError):
                    continue
            covered_weight = sum(weights[mth - 1] for mth in covered_months if 1 <= mth <= 12)
            entry["months_covered"] = len(pts)
            entry["forecast_mt"] = float(sum(float(p.predicted_value or 0) for p in pts))
            entry["target_share_mt"] = annual_target * share * covered_weight
            entry["months_label"] = f"{len(pts)} of 12 months"
        rows.append(entry)
    return rows


def evaluate_target(
    municipality_id: Optional[int],
    annual_target: float,
    forecast_horizon: int = 12,
    split_method: str = "equal",
    target_basis: str = "annual",
):
    """Compute month-specific target weights and evaluate against forecast.

    Never pads forecasts with zeros; uses real forecast points only and returns
    shortfall_months. Totals and variance are computed only from real values.

    split_method:
    - "equal": flat 1/12 per month.
    - "seasonal": data-derived monthly profile (falls back to hardcoded
      Pangasinan weights when fewer than 2 complete years exist).

    target_basis:
    - "annual": annual_target is an annual figure; monthly targets are derived
      from annual_target × monthly weight (existing behavior).
    - "period": annual_target is the total for the selected horizon; monthly
      targets are derived by normalizing weights over the effective horizon so
      they sum to annual_target.
    """
    if split_method == "seasonal":
        raw_weights, weights_source = _derive_seasonal_weights(municipality_id)
    else:
        raw_weights = [1.0 / 12.0] * 12
        weights_source = "default"

    forecast_labels = []
    forecast_values = []
    forecast_lower = []
    forecast_upper = []
    if municipality_id is not None:
        latest_run = (
            ForecastRun.query.filter_by(municipality_id=municipality_id)
            .order_by(ForecastRun.created_at.desc())
            .first()
        )
    else:
        latest_run = (
            ForecastRun.query.filter_by(municipality_id=None)
            .order_by(ForecastRun.created_at.desc())
            .first()
        )

    if latest_run and latest_run.points:
        forecast_points = [p for p in latest_run.points if p.is_forecast]
        forecast_points.sort(key=lambda p: p.period_label)
        forecast_labels = [p.period_label for p in forecast_points[:forecast_horizon]]
        # Real forecast points only — never pad with zeros.
        forecast_values = [float(p.predicted_value or 0) for p in forecast_points[:forecast_horizon]]
        # Expected range per month, straight from the stored run.
        forecast_lower = [
            (float(p.lower_bound) if p.lower_bound is not None else None)
            for p in forecast_points[:forecast_horizon]
        ]
        forecast_upper = [
            (float(p.upper_bound) if p.upper_bound is not None else None)
            for p in forecast_points[:forecast_horizon]
        ]

    shortfall_months = max(0, forecast_horizon - len(forecast_values))
    effective_horizon = len(forecast_values)

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    # Index seasonal weights by the REAL calendar month of each forecast point
    # (parsed from period_label), not by position (m % 12). For the equal split
    # raw_weights is uniform so this yields flat 1/12 weights either way.
    calendar_months = []
    for label in forecast_labels:
        try:
            cal_month = int(label[5:7])  # 1..12
        except (ValueError, IndexError):
            cal_month = (len(calendar_months) % 12) + 1
        calendar_months.append(cal_month)

    if target_basis == "period":
        # annual_target is the total for the selected horizon; normalize weights
        # over the effective horizon so monthly targets sum to annual_target.
        if effective_horizon == 0:
            month_weights = []
        elif split_method == "equal":
            month_weights = [1.0 / effective_horizon] * effective_horizon
        else:
            month_weights_raw = [raw_weights[cal_month - 1] for cal_month in calendar_months]
            weight_sum = sum(month_weights_raw)
            month_weights = [w / weight_sum for w in month_weights_raw] if weight_sum > 0 else [1.0 / effective_horizon] * effective_horizon
        monthly_targets = [annual_target * w for w in month_weights]
    else:
        # "annual" basis (existing behavior): monthly_targets = annual_target ×
        # monthly weight. total_target may differ from annual_target when the
        # effective horizon is less than 12 months.
        if effective_horizon == 0:
            month_weights = []
            monthly_targets = []
        else:
            month_weights = [raw_weights[cal_month - 1] for cal_month in calendar_months]
            monthly_targets = [annual_target * w for w in month_weights]

    total_target = sum(monthly_targets)
    total_projected = sum(forecast_values) if forecast_values else 0.0
    variance = total_projected - total_target
    variance_pct = (variance / total_target * 100.0) if total_target > 0 else 0.0
    achievable = variance >= 0

    below_months = []
    above_months = []
    for i in range(effective_horizon):
        cal_month = calendar_months[i]
        if forecast_values[i] < monthly_targets[i]:
            below_months.append(month_names[cal_month - 1])
        elif forecast_values[i] > monthly_targets[i]:
            above_months.append(month_names[cal_month - 1])

    trend_direction = _trend_direction(latest_run.expected_change_pct) if latest_run else "stable"
    trend_notes = {
        "increasing": "The forecast is trending upward, which supports hitting your target.",
        "declining": "The forecast is trending downward, so reaching this target will require extra effort or intervention.",
        "stable": "The forecast is holding steady, making the target more predictable.",
    }
    trend_note = trend_notes.get(trend_direction, trend_notes["stable"])

    wet_months = {6, 7, 8, 9, 10, 11}
    peak_month_idx = max(range(12), key=lambda i: raw_weights[i])
    low_month_idx = min(range(12), key=lambda i: raw_weights[i])
    seasonal_note = (
        f"Historically, {month_names[low_month_idx]} is the lowest-output month and "
        f"{month_names[peak_month_idx]} is the peak. Plan around this seasonal rhythm."
    )

    recommendations = []
    if not achievable:
        recommendations.append(
            f"Target is out of reach by {abs(variance):,.0f} Metric Tons (MT) ({abs(variance_pct):.1f}%). "
            f"Increase capacity, improve yields, or extend the horizon beyond {forecast_horizon} months."
        )
    if trend_direction == "declining":
        recommendations.append(
            "The declining trend will compound over time. Investigate causes now—such as reduced planting area, weather shocks, or labor shortages—and address them before the next cycle."
        )
    if trend_direction == "increasing":
        recommendations.append(
            "The upward trend is favorable. Protect this momentum by maintaining inputs, labor, and quality standards through the peak season."
        )
    if below_months:
        recommendations.append(
            f"Schedule interventions or incentives before {', '.join(below_months)}. "
            f"These months are projected to fall short of their monthly targets."
        )
    if above_months:
        recommendations.append(
            f"{', '.join(above_months)} are projected to exceed target. Use this surplus to buffer below-target months or build inventory."
        )
    if peak_month_idx in wet_months:
        recommendations.append(
            f"Peak season is during the rainy months ({month_names[peak_month_idx]}). Ensure harvesting and processing capacity can handle wet-weather constraints."
        )
    if not recommendations:
        recommendations.append("Target looks achievable based on current trajectory. Keep monitoring monthly against these weighted targets.")

    monthly_avg_note = (
        f"This breaks down to roughly {annual_target / 12:,.1f} Metric Tons (MT) per month on average, "
        f"but actual monthly targets vary because historical production is not evenly distributed throughout the year."
    )
    if municipality_id is not None:
        scope_note = f"for the selected municipality"
    else:
        scope_note = "province-wide"
    scope_intro = f"This evaluation is {scope_note}."

    # --- Evaluation year (never hardcoded) ---------------------------------
    # The calendar year of the latest approved record for this scope. The
    # year-end projection is the approved records so far plus the forecast for
    # the remaining months of that same year.
    last_record_month = _last_month_with_data(municipality_id)
    evaluation_year = int(last_record_month[:4]) if last_record_month else date.today().year
    months_remaining_in_year = (12 - int(last_record_month[5:7])) if last_record_month else 0

    # Approved records so far in the evaluation year, by month.
    ytd_labels, ytd_values, _ = _monthly_aggregates(
        municipality_id, date(evaluation_year, 1, 1), date(evaluation_year, 12, 31)
    )
    ytd_approved = [
        {"month": lb, "total_mt": float(v)} for lb, v in zip(ytd_labels, ytd_values)
    ]
    ytd_approved_total = float(sum(r["total_mt"] for r in ytd_approved))

    # Forecast months that fall inside the evaluation year, and the share of
    # the annual target those months carry.
    in_year_indices = [
        i for i, lb in enumerate(forecast_labels) if int(lb[:4]) == evaluation_year
    ]
    forecast_months_in_year = len(in_year_indices)
    target_for_forecast_months = float(sum(monthly_targets[i] for i in in_year_indices))
    forecast_total_in_year = float(sum(forecast_values[i] for i in in_year_indices))
    forecast_lower_in_year = float(sum(forecast_lower[i] for i in in_year_indices if forecast_lower[i] is not None))
    forecast_upper_in_year = float(sum(forecast_upper[i] for i in in_year_indices if forecast_upper[i] is not None))

    # Per-municipality breakdown (province scope only), read-only.
    municipality_breakdown = []
    if municipality_id is None:
        municipality_breakdown = _municipality_target_breakdown(
            float(annual_target), list(raw_weights), forecast_horizon
        )

    sign = "+" if variance >= 0 else ""
    narrative = (
        f"{scope_intro} {monthly_avg_note} "
        f"The projected total is {total_projected:,.2f} Metric Tons (MT), which is {sign}{variance:,.2f} Metric Tons (MT) ({sign}{variance_pct:.1f}%) "
        f"{'above' if variance >= 0 else 'below'} the annual target. "
        f"{trend_note} {seasonal_note} "
        f"Overall, this target looks {'achievable' if achievable else 'challenging'}. "
        + " ".join(recommendations)
    )

    return {
        "municipality_id": municipality_id,
        "annual_target": float(annual_target),
        "forecast_horizon": forecast_horizon,
        "shortfall_months": shortfall_months,
        "forecast_labels": forecast_labels,
        "monthly_targets": [float(t) for t in monthly_targets],
        "monthly_forecasts": [float(v) for v in forecast_values],
        "forecast_lower": [float(v) if v is not None else None for v in forecast_lower],
        "forecast_upper": [float(v) if v is not None else None for v in forecast_upper],
        "evaluation_year": evaluation_year,
        "last_record_month": last_record_month,
        "months_remaining_in_year": months_remaining_in_year,
        "forecast_months_in_year": forecast_months_in_year,
        "target_for_forecast_months": target_for_forecast_months,
        "forecast_total_in_year": forecast_total_in_year,
        "forecast_lower_in_year": forecast_lower_in_year,
        "forecast_upper_in_year": forecast_upper_in_year,
        "ytd_approved": ytd_approved,
        "ytd_approved_total": ytd_approved_total,
        "municipality_breakdown": municipality_breakdown,
        "total_target": float(total_target),
        "total_projected": float(total_projected),
        "variance": float(variance),
        "variance_pct": float(variance_pct),
        "achievable": achievable,
        "trend_direction": trend_direction,
        "trend_note": trend_note,
        "seasonal_note": seasonal_note,
        "peak_month": month_names[peak_month_idx],
        "low_month": month_names[low_month_idx],
        "below_months": below_months,
        "above_months": above_months,
        "recommendations": recommendations,
        "narrative": narrative,
        "weights": [float(w) for w in month_weights],
        # The raw 12 calendar-month shares (index 0 = January), so a caller can
        # build a full-year target path even when the horizon is short.
        "seasonal_weights": [float(w) for w in raw_weights],
        "weights_source": weights_source,
        "target_basis": target_basis,
    }
