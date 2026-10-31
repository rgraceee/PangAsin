# WHAT: Core forecasting logic (monthly aggregation, model fitting, forecast run,
#       outlook, target evaluation).
# WHY: Hiwalay sa API layer para ma-test/ma-reuse ang parehong Math kahit saan.
from datetime import date
from typing import List, Optional, Tuple

import numpy as np
import warnings

from app.extensions import db
from app.models.forecast import ForecastRun, ForecastPoint
from app.models.municipality import Municipality
from app.models.municipality_production import MunicipalityMonthlyProduction
from app.services.aggregates import (
    _monthly_aggregates,
    _reindex_complete,
    _last_month_with_data,
)
from sqlalchemy import func

# Reference epoch for computing real (non-compressed) month positions.
_EPOCH_YEAR = 2000
_EPOCH_MONTH = 1
PRODUCTION_DATA_SOURCE = "municipality_production"


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

def _plan_arima():
    def fit(offsets, values):
        from statsmodels.tsa.arima.model import ARIMA

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = ARIMA(
                np.log1p(np.asarray(values, dtype=float)),
                order=(1, 1, 1),
            ).fit()
        return {"model": model}

    def predict_next(state, offsets, values):
        transformed_prediction = float(
            np.asarray(state["model"].forecast(steps=1))[0]
        )
        return max(0.0, float(np.expm1(transformed_prediction)))

    return {"name": "arima", "fit": fit, "predict_next": predict_next}


def _plan_sarima():
    plan = {
        "name": "sarima",
        "fit": None,
        "predict_next": None,
        "order": [1, 1, 1],
        "seasonal_order": [1, 1, 1, 12],
    }

    def fit(offsets, values):
        if len(values) < 24:
            raise ValueError("SARIMA requires at least 24 monthly observations.")

        from statsmodels.tsa.statespace.sarimax import SARIMAX

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = SARIMAX(
                np.asarray(values, dtype=float),
                order=(1, 1, 1),
                seasonal_order=(1, 1, 1, 12),
                enforce_stationarity=False,
                enforce_invertibility=False,
            ).fit(disp=False)
        return {"model": model}

    def predict_next(state, offsets, values):
        return float(np.asarray(state["model"].get_forecast(steps=1).predicted_mean)[0])

    plan["fit"] = fit
    plan["predict_next"] = predict_next
    return plan


def _plan_seasonal_naive():
    def fit(offsets, values):
        return {
            "values": list(values),
            "last_offset": offsets[-1],
        }

    def predict_next(state, offsets, values):
        if len(state["values"]) >= 12:
            return float(state["values"][-12])
        return float(state["values"][-1])

    return {"name": "seasonal_naive", "fit": fit, "predict_next": predict_next}


_MODEL_PLANS = {
    "arima": _plan_arima,
    "sarima": _plan_sarima,
    "seasonal_naive": _plan_seasonal_naive,
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
    """Select ARIMA, SARIMA, or seasonal naive from a rolling holdout.

    Candidate fit failures are recorded in candidate_metrics so another
    available model can still be selected without hiding the failure.
    """
    n = len(values)
    holdout = max(2, min(6, n // 3))
    train_n = n - holdout
    if train_n < 3:
        return "seasonal_naive", None, None

    train_offsets = offsets[:train_n]
    train_values = values[:train_n]
    test_values = values[train_n:]

    candidate_metrics = {}
    results = {}
    for name, plan_factory in _MODEL_PLANS.items():
        plan = plan_factory()
        try:
            preds = _walk_forecast(plan, train_offsets, train_values, holdout)
            m = _metrics(test_values, preds) or {}
        except (ImportError, ValueError, RuntimeError, np.linalg.LinAlgError) as exc:
            m = {
                "mae": None,
                "rmse": None,
                "mape": None,
                "r2": None,
                "error": f"Training unavailable: {type(exc).__name__}.",
            }
        if name == "arima":
            m["order"] = [1, 1, 1]
        elif name == "sarima":
            m["order"] = [1, 1, 1]
            m["seasonal_order"] = [1, 1, 1, 12]
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


def _non_nan_pairs(offsets: List[int], values: List[Optional[float]]) -> Tuple[List[int], List[float]]:
    """Return (offsets, values) with NaN / None months removed.

    Model fitting uses observed points only, so missing months are never
    treated as zeros.
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

def _save_empty_run(
    municipality_id,
    period_start,
    period_end,
    note,
    run=None,
    readiness="not_ready",
):
    # WHAT: Finish a run with no forecast points.
    # WHY: Callers still need a run row even when there is nothing to model.
    if run is None:
        run = ForecastRun(
            municipality_id=municipality_id,
            period_start=period_start,
            period_end=period_end,
            readiness=readiness,
            data_source=PRODUCTION_DATA_SOURCE,
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
    run.note = note
    db.session.commit()
    return run


def _confidence_band(
    obs_values,
    backtest,
    preds,
    history_count,
    sarima_state,
    sarima_lower,
    sarima_upper,
):
    # WHAT: Build lower/upper bounds aligned to the full history+forecast index.
    # WHY: History has no band; future points use SARIMA limits or a residual band.
    if sarima_state is not None and sarima_lower is not None and sarima_upper is not None:
        return (
            [None] * history_count + sarima_lower,
            [None] * history_count + sarima_upper,
        )

    y_full = np.array(obs_values, dtype=float)
    residuals = np.array([
        point["actual"] - point["predicted"]
        for point in (backtest or [])
        if point.get("actual") is not None
    ], dtype=float)
    monthly_avg = float(np.mean(y_full)) if len(y_full) else 0.0
    if len(residuals) > 1:
        std_err = float(np.std(residuals, ddof=1))
    elif len(residuals) == 1:
        std_err = abs(float(residuals[0]))
    else:
        std_err = float(np.std(y_full)) * 0.5 if len(y_full) else monthly_avg * 0.2
    std_err = max(std_err, monthly_avg * 0.05)
    all_lower = [None] * history_count + [
        max(0.0, float(value) - 1.65 * std_err) for value in preds
    ]
    all_upper = [None] * history_count + [
        max(0.0, float(value) + 1.65 * std_err) for value in preds
    ]
    return all_lower, all_upper


def _model_comparison_rows(candidate_metrics, chosen):
    # WHAT: Rank candidate models by RMSE and mark the chosen one.
    # WHY: The UI shows why this algorithm was selected.
    if not candidate_metrics:
        return None
    comparison = []
    for algorithm, metrics in candidate_metrics.items():
        comparison.append({
            "algorithm": algorithm,
            "rmse": metrics.get("rmse") if isinstance(metrics, dict) else None,
            "mae": metrics.get("mae") if isinstance(metrics, dict) else None,
            "mape": metrics.get("mape") if isinstance(metrics, dict) else None,
            "chosen": algorithm == chosen,
        })
    comparison.sort(
        key=lambda item: item["rmse"] if item["rmse"] is not None else float("inf")
    )
    return comparison


def run_forecast(municipality_id: Optional[int] = None, forecast_horizon: int = 12):
    # WHAT: Generate at i-save ang isang ForecastRun gamit ang pinakamagandang model.
    # WHY: Ito ang tawab ng /forecast/run. Ang history window ay awtomatikong
    #      itinataas (huling 3 taon bago ang huling buwan may data) at ang
    #      forecast ay 12 buwan sa hinaharap mula sa huling buwan may data.
    #      Hindi na kailangang mag-input ng period_start / period_end.
    forecast_horizon = max(1, min(36, int(forecast_horizon or 12)))

    # Auto history window: last 3 years up to the last month with data.
    last_ym = _last_month_with_data(municipality_id, source="production")
    if last_ym is None:
        return _save_empty_run(
            municipality_id,
            date.today().replace(day=1),
            date.today().replace(day=1),
            "No municipality production data is available for this scope.",
        )

    ly, lm = int(last_ym[:4]), int(last_ym[5:7])
    period_end = date(ly, lm, 1)
    period_start = date(ly - 3, lm, 1)

    labels, values, offsets = _monthly_aggregates(
        municipality_id, period_start, period_end, source="production"
    )
    # Complete monthly index; missing months are None (never zeros).
    complete_labels, complete_values, complete_offsets = _reindex_complete(
        labels, values, offsets, period_start.isoformat()[:7], last_ym)

    observed_labels = [
        label for label, value in zip(complete_labels, complete_values)
        if value is not None
    ]
    readiness = _readiness(observed_labels)

    run = ForecastRun(
        municipality_id=municipality_id,
        period_start=period_start,
        period_end=period_end,
        readiness=readiness,
        data_source=PRODUCTION_DATA_SOURCE,
    )
    db.session.add(run)
    db.session.flush()

    # Work with the observed (non-NaN) series for modeling; gaps stay gaps.
    obs_offsets, obs_values = _non_nan_pairs(complete_offsets, complete_values)

    if readiness == "not_ready" or not obs_values or len(obs_values) < 6:
        return _save_empty_run(
            municipality_id,
            period_start,
            period_end,
            "Insufficient municipality production data to forecast "
            "(need at least 6 observed months).",
            run=run,
            readiness=readiness,
        )

    last_label = complete_labels[-1] if complete_labels else last_ym
    all_labels = complete_labels + [_next_month_label(last_label, i + 1) for i in range(forecast_horizon)]
    note = None

    sarima_state = None
    sarima_lower = None
    sarima_upper = None

    candidate_metrics = None
    winner_metrics = None
    algorithm = "none"
    preds = []

    winner, winner_metrics, candidate_metrics = _best_model(obs_offsets, obs_values)
    algorithm = winner

    if algorithm == "sarima":
        plan = _MODEL_PLANS["sarima"]()
        try:
            sarima_state = plan["fit"](obs_offsets, obs_values)
            forecast = sarima_state["model"].get_forecast(steps=forecast_horizon)
            preds = [max(0.0, float(value)) for value in forecast.predicted_mean]
            confidence = forecast.conf_int(alpha=0.10)
            confidence_values = (
                confidence.values if hasattr(confidence, "values") else confidence
            )
            sarima_lower = [
                max(0.0, float(row[0])) for row in confidence_values
            ]
            sarima_upper = [
                max(0.0, float(row[1])) for row in confidence_values
            ]
        except (ImportError, ValueError, RuntimeError, np.linalg.LinAlgError) as exc:
            sarima_state = None
            algorithm = "seasonal_naive"
            winner_metrics = (candidate_metrics or {}).get("seasonal_naive")
            preds = _walk_forecast(
                _MODEL_PLANS["seasonal_naive"](),
                obs_offsets,
                obs_values,
                forecast_horizon,
            )
            note = (
                "SARIMA fitting failed; seasonal naive was used instead "
                f"({type(exc).__name__})."
            )
    else:
        plan = _MODEL_PLANS[algorithm]()
        preds = _walk_forecast(plan, obs_offsets, obs_values, forecast_horizon)

    # Backtest (accuracy check) for the chosen model's holdout months.
    backtest = None
    if winner_metrics is not None:
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
    all_lower, all_upper = _confidence_band(
        obs_values,
        backtest,
        preds,
        n_hist,
        sarima_state,
        sarima_lower,
        sarima_upper,
    )

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
    model_comparison = _model_comparison_rows(candidate_metrics, algorithm)

    run.algorithm = algorithm
    run.reliability = _reliability(readiness, len(obs_values))
    run.trend_direction = trend
    run.expected_change_pct = expected
    run.projected_total = projected
    run.mae = winner_metrics["mae"] if winner_metrics and winner_metrics.get("mae") is not None else None
    run.rmse = winner_metrics["rmse"] if winner_metrics and winner_metrics.get("rmse") is not None else None
    run.mape = winner_metrics["mape"] if winner_metrics and winner_metrics.get("mape") is not None else None
    run.r2 = winner_metrics["r2"] if winner_metrics and winner_metrics.get("r2") is not None else None
    run.candidate_metrics = candidate_metrics
    source_note = (
        "Forecast trained on source-labeled municipality monthly production data; "
        "all monthly values are estimates and the 2026 Jan-Sep series is generated."
    )
    run.note = f"{note} {source_note}" if note else source_note
    run.incomplete_tail = False
    run.backtest = backtest
    db.session.commit()
    return run


def _latest_forecast_run(municipality_id):
    return (
        ForecastRun.query.filter_by(
            municipality_id=municipality_id,
            data_source=PRODUCTION_DATA_SOURCE,
        )
        .order_by(ForecastRun.created_at.desc())
        .first()
    )


def _add_forecast_point_data(month_preds, month_lower, month_upper, point):
    # WHAT: Append one forecast point's value and half-widths per month label.
    # WHY: The all-municipalities run aggregates these lists later.
    value = float(point.predicted_value or 0)
    month_preds.setdefault(point.period_label, []).append(value)
    if point.lower_bound is not None and point.upper_bound is not None:
        month_lower.setdefault(point.period_label, []).append(
            value - float(point.lower_bound)
        )
        month_upper.setdefault(point.period_label, []).append(
            float(point.upper_bound) - value
        )


def _collect_municipality_forecasts(municipalities, forecast_horizon):
    # WHAT: Reuse a recent forecast when it matches the data, else run a new one.
    # WHY: Avoids re-running models that are still current for this horizon.
    month_preds = {}
    month_lower = {}
    month_upper = {}
    any_ready = False
    for municipality in municipalities:
        latest_data_month = _last_month_with_data(municipality.id, source="production")
        latest = _latest_forecast_run(municipality.id)
        latest_points = (
            sorted(
                [point for point in latest.points if point.is_forecast],
                key=lambda point: point.period_label,
            )
            if latest and latest.points
            else []
        )
        latest_matches_data = (
            latest_data_month is not None
            and latest is not None
            and latest.period_end.strftime("%Y-%m") == latest_data_month
        )
        if latest_matches_data and len(latest_points) >= forecast_horizon:
            for point in latest_points[:forecast_horizon]:
                _add_forecast_point_data(month_preds, month_lower, month_upper, point)
            if latest.algorithm != "none":
                any_ready = True
            continue

        run = run_forecast(municipality.id, forecast_horizon)
        for point in run.points:
            if point.is_forecast:
                _add_forecast_point_data(
                    month_preds, month_lower, month_upper, point
                )
        if run.algorithm != "none":
            any_ready = True
    return month_preds, month_lower, month_upper, any_ready


def _rss_bounds(all_labels, all_values, month_lower, month_upper):
    # WHAT: Combine per-municipality half-widths by root-sum-square.
    # WHY: Independent municipality errors add in quadrature, not linearly.
    all_lower = []
    all_upper = []
    for index, label in enumerate(all_labels):
        lowers = month_lower.get(label, [])
        uppers = month_upper.get(label, [])
        if lowers and uppers:
            rss_hi = sum(width * width for width in uppers) ** 0.5
            rss_lo = sum(width * width for width in lowers) ** 0.5
            all_lower.append(max(0.0, all_values[index] - rss_lo))
            all_upper.append(max(0.0, all_values[index] + rss_hi))
        else:
            all_lower.append(None)
            all_upper.append(None)
    return all_lower, all_upper


def _weighted_expected_change(municipalities):
    # WHAT: Average each municipality's expected change, weighted by its total.
    # WHY: Gives the province run a real direction instead of a hardcoded one.
    total_weighted_change = 0.0
    total_weight = 0.0
    for municipality in municipalities:
        latest = _latest_forecast_run(municipality.id)
        if (
            latest
            and latest.expected_change_pct is not None
            and latest.projected_total is not None
        ):
            weight = float(latest.projected_total)
            if weight > 0:
                total_weighted_change += float(latest.expected_change_pct) * weight
                total_weight += weight
    return (total_weighted_change / total_weight) if total_weight > 0 else None


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

    (
        month_preds,
        month_lower,
        month_upper,
        any_ready,
    ) = _collect_municipality_forecasts(municipalities, forecast_horizon)

    if not any_ready or not month_preds:
        # No data anywhere: create an empty all-municipalities run.
        return _save_empty_run(
            None,
            date.today().replace(day=1),
            date.today().replace(day=1),
            "No municipality production data is available.",
        )

    all_labels = sorted(month_preds.keys())[:forecast_horizon]
    all_values = [sum(month_preds[label]) for label in all_labels]

    all_lower, all_upper = _rss_bounds(
        all_labels, all_values, month_lower, month_upper
    )

    all_expected_change = _weighted_expected_change(municipalities)

    run = ForecastRun(
        municipality_id=None,
        period_start=date(int(all_labels[0][:4]), int(all_labels[0][5:7]), 1),
        period_end=date(int(all_labels[-1][:4]), int(all_labels[-1][5:7]), 1),
        readiness="ready" if any_ready else "not_ready",
        data_source=PRODUCTION_DATA_SOURCE,
    )
    db.session.add(run)
    db.session.flush()
    for index, label in enumerate(all_labels):
        db.session.add(ForecastPoint(
            run_id=run.id,
            period_label=label,
            predicted_value=all_values[index],
            lower_bound=all_lower[index],
            upper_bound=all_upper[index],
            is_forecast=True,
        ))
    run.algorithm = "seasonal_baseline"
    run.reliability = "moderate" if any_ready else "low"
    run.trend_direction = _trend_direction(all_expected_change)
    run.expected_change_pct = all_expected_change
    run.projected_total = float(sum(all_values))
    run.candidate_metrics = None
    run.model_comparison = None
    run.backtest = None
    run.note = (
        "Province total is the sum of municipality production forecasts; "
        "the band is the root-sum-square of per-municipality half-widths. "
        "Historical municipality production is sourced from the workbook dataset."
    )
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
            ForecastRun.query.filter_by(
                municipality_id=m.id,
                data_source=PRODUCTION_DATA_SOURCE,
            )
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
            labels, values, offsets = _monthly_aggregates(
                m.id, date(2020, 1, 1), date.today(), source="production"
            )
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
    labels, values, _ = _monthly_aggregates(
        municipality_id, hist_start, hist_end, source="production"
    )

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
    labels, _, _ = _monthly_aggregates(
        municipality_id, date(2000, 1, 1), date.today(), source="production"
    )
    counts: dict = {}
    for lb in labels:
        y = int(lb[:4])
        counts[y] = counts.get(y, 0) + 1
    return sorted(y for y, c in counts.items() if c >= 10)


def _estimated_production_by_municipality(years: List[int]) -> dict:
    """Estimated production per municipality over the given complete years."""
    if not years:
        return {}
    rows = (
        db.session.query(
            MunicipalityMonthlyProduction.municipality_id,
            func.sum(MunicipalityMonthlyProduction.production_kg).label("kg"),
        )
        .filter(MunicipalityMonthlyProduction.production_year.in_(years))
        .group_by(MunicipalityMonthlyProduction.municipality_id)
        .all()
    )
    return {r.municipality_id: float(r.kg or 0) / 1000.0 for r in rows}


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
        .filter(ForecastRun.data_source == PRODUCTION_DATA_SOURCE)
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
    historical = _estimated_production_by_municipality(complete_years)
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


def _latest_scope_run(municipality_id):
    # WHAT: Fetch the newest production forecast run for this scope.
    # WHY: None means the province-wide run; otherwise the municipality run.
    return (
        ForecastRun.query.filter_by(
            municipality_id=municipality_id,
            data_source=PRODUCTION_DATA_SOURCE,
        )
        .order_by(ForecastRun.created_at.desc())
        .first()
    )


def _forecast_series(latest_run, forecast_horizon):
    # WHAT: Slice the stored forecast points into label/value/bound lists.
    # WHY: Real forecast points only; missing months are never padded with zeros.
    if not latest_run or not latest_run.points:
        return [], [], [], []

    forecast_points = [point for point in latest_run.points if point.is_forecast]
    forecast_points.sort(key=lambda point: point.period_label)
    selected = forecast_points[:forecast_horizon]
    labels = [point.period_label for point in selected]
    values = [float(point.predicted_value or 0) for point in selected]
    lowers = [
        float(point.lower_bound) if point.lower_bound is not None else None
        for point in selected
    ]
    uppers = [
        float(point.upper_bound) if point.upper_bound is not None else None
        for point in selected
    ]
    return labels, values, lowers, uppers


def _calendar_month(label, index):
    # WHAT: Read the calendar month from a period label.
    # WHY: Seasonal weights must follow the real month, not the list position.
    try:
        return int(label[5:7])
    except (ValueError, IndexError):
        return (index % 12) + 1


def _month_weights_and_targets(
    target_basis,
    split_method,
    effective_horizon,
    annual_target,
    raw_weights,
    calendar_months,
):
    # WHAT: Derive per-month weights and the resulting monthly targets.
    # WHY: Period basis normalizes over the horizon; annual basis keeps the
    #      calendar-month shares unchanged.
    if effective_horizon == 0:
        return [], []

    if target_basis == "period":
        if split_method == "equal":
            month_weights = [1.0 / effective_horizon] * effective_horizon
        else:
            month_weights_raw = [
                raw_weights[calendar_month - 1]
                for calendar_month in calendar_months
            ]
            weight_sum = sum(month_weights_raw)
            if weight_sum > 0:
                month_weights = [
                    weight / weight_sum for weight in month_weights_raw
                ]
            else:
                month_weights = [1.0 / effective_horizon] * effective_horizon
        return month_weights, [annual_target * weight for weight in month_weights]

    month_weights = [
        raw_weights[calendar_month - 1] for calendar_month in calendar_months
    ]
    return month_weights, [annual_target * weight for weight in month_weights]


def _target_recommendations(
    achievable,
    variance,
    variance_pct,
    forecast_horizon,
    trend_direction,
    below_months,
    above_months,
    peak_month_idx,
    wet_months,
    month_names,
):
    # WHAT: Build the plain-language action list for the evaluation page.
    # WHY: Each trigger adds one concrete recommendation, in a fixed order.
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
    return recommendations


def _year_projection(
    municipality_id,
    forecast_labels,
    forecast_values,
    forecast_lower,
    forecast_upper,
    monthly_targets,
):
    # WHAT: Year-end view: approved records so far plus in-year forecast.
    # WHY: The evaluation year comes from the latest approved record, never a
    #      hardcoded year.
    last_record_month = _last_month_with_data(
        municipality_id, source="production"
    )
    evaluation_year = (
        int(last_record_month[:4]) if last_record_month else date.today().year
    )
    months_remaining_in_year = (
        (12 - int(last_record_month[5:7])) if last_record_month else 0
    )

    ytd_labels, ytd_values, _ = _monthly_aggregates(
        municipality_id,
        date(evaluation_year, 1, 1),
        date(evaluation_year, 12, 31),
        source="production",
    )
    ytd_approved = [
        {"month": label, "total_mt": float(value)}
        for label, value in zip(ytd_labels, ytd_values)
    ]
    ytd_approved_total = float(sum(row["total_mt"] for row in ytd_approved))

    in_year_indices = [
        index
        for index, label in enumerate(forecast_labels)
        if int(label[:4]) == evaluation_year
    ]
    return {
        "evaluation_year": evaluation_year,
        "last_record_month": last_record_month,
        "months_remaining_in_year": months_remaining_in_year,
        "ytd_approved": ytd_approved,
        "ytd_approved_total": ytd_approved_total,
        "forecast_months_in_year": len(in_year_indices),
        "target_for_forecast_months": float(
            sum(monthly_targets[index] for index in in_year_indices)
        ),
        "forecast_total_in_year": float(
            sum(forecast_values[index] for index in in_year_indices)
        ),
        "forecast_lower_in_year": float(
            sum(
                forecast_lower[index]
                for index in in_year_indices
                if forecast_lower[index] is not None
            )
        ),
        "forecast_upper_in_year": float(
            sum(
                forecast_upper[index]
                for index in in_year_indices
                if forecast_upper[index] is not None
            )
        ),
    }


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
    latest_run = _latest_scope_run(municipality_id)

    (
        forecast_labels,
        forecast_values,
        forecast_lower,
        forecast_upper,
    ) = _forecast_series(latest_run, forecast_horizon)

    shortfall_months = max(0, forecast_horizon - len(forecast_values))
    effective_horizon = len(forecast_values)

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    # Index seasonal weights by the REAL calendar month of each forecast point
    # (parsed from period_label), not by position (m % 12). For the equal split
    # raw_weights is uniform so this yields flat 1/12 weights either way.
    calendar_months = [
        _calendar_month(label, index)
        for index, label in enumerate(forecast_labels)
    ]

    month_weights, monthly_targets = _month_weights_and_targets(
        target_basis,
        split_method,
        effective_horizon,
        annual_target,
        raw_weights,
        calendar_months,
    )

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

    recommendations = _target_recommendations(
        achievable,
        variance,
        variance_pct,
        forecast_horizon,
        trend_direction,
        below_months,
        above_months,
        peak_month_idx,
        wet_months,
        month_names,
    )

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
    projection = _year_projection(
        municipality_id,
        forecast_labels,
        forecast_values,
        forecast_lower,
        forecast_upper,
        monthly_targets,
    )
    evaluation_year = projection["evaluation_year"]
    last_record_month = projection["last_record_month"]
    months_remaining_in_year = projection["months_remaining_in_year"]
    ytd_approved = projection["ytd_approved"]
    ytd_approved_total = projection["ytd_approved_total"]
    forecast_months_in_year = projection["forecast_months_in_year"]
    target_for_forecast_months = projection["target_for_forecast_months"]
    forecast_total_in_year = projection["forecast_total_in_year"]
    forecast_lower_in_year = projection["forecast_lower_in_year"]
    forecast_upper_in_year = projection["forecast_upper_in_year"]

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
