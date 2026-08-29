from decimal import Decimal
from datetime import date

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from app.extensions import db
from app.models.production_record import ProductionRecord
from app.models.forecast_run import ForecastRun
from app.models.forecast_result import ForecastResult
from app.models.municipality import Municipality


def run_forecast(municipality_id, model_name, user_id):
    m = Municipality.query.get(municipality_id)
    if not m:
        return None

    records = ProductionRecord.query.filter_by(municipality_id=municipality_id, status="approved").order_by(ProductionRecord.record_date).all()
    if not records or len(records) < 2:
        return {
            "run_id": None,
            "model_name": model_name,
            "municipality_name": m.name,
            "metrics": {},
            "results": [],
            "error": "Insufficient approved records for forecasting.",
        }

    grouped = _group_by_period(records)
    preferred = ["monthly", "annual", "daily"]
    used_type = None
    for ptype in preferred:
        if ptype in grouped and len(grouped[ptype]) >= 2:
            used_type = ptype
            break

    if not used_type:
        return {
            "run_id": None,
            "model_name": model_name,
            "municipality_name": m.name,
            "metrics": {},
            "results": [],
            "error": "No suitable period type with sufficient records for forecasting.",
        }

    recs = grouped[used_type]
    recs.sort(key=lambda r: r.record_date)
    dates = [r.record_date for r in recs]
    volumes = [float(r.production_volume) for r in recs]

    x = np.arange(len(volumes)).reshape(-1, 1)
    y = np.array(volumes)

    forecast_values, metrics = _fit_model(model_name, x, y)
    if forecast_values is None:
        return {
            "run_id": None,
            "model_name": model_name,
            "municipality_name": m.name,
            "metrics": {},
            "results": [],
            "error": "Unsupported model or insufficient data.",
        }

    last_date = dates[-1]
    if used_type == "monthly":
        future_dates = [_add_months(last_date, i + 1) for i in range(3)]
    elif used_type == "annual":
        future_dates = [date(last_date.year + i + 1, last_date.month, last_date.day) for i in range(3)]
    else:
        future_dates = [date.fromordinal(last_date.toordinal() + (i + 1) * 30) for i in range(3)]

    trend_direction = _determine_trend(forecast_values)
    results = []
    for i, val in enumerate(forecast_values):
        fv = Decimal(str(round(val, 2)))
        margin = fv * Decimal("0.1")
        results.append({
            "forecast_period": future_dates[i],
            "forecast_production": fv,
            "lower_bound": fv - margin,
            "upper_bound": fv + margin,
            "trend_direction": trend_direction,
        })

    run = ForecastRun(
        model_name=model_name,
        model_version="1.0",
        municipality_id=municipality_id,
        training_start_date=dates[0],
        training_end_date=dates[-1],
        parameters={},
        mae=Decimal(str(round(metrics.get("mae", 0), 4))) if metrics.get("mae") is not None else None,
        rmse=Decimal(str(round(metrics.get("rmse", 0), 4))) if metrics.get("rmse") is not None else None,
        mape=Decimal(str(round(metrics.get("mape", 0), 4))) if metrics.get("mape") is not None else None,
        r_squared=Decimal(str(round(metrics.get("r_squared", 0), 4))) if metrics.get("r_squared") is not None else None,
        generated_by=user_id,
    )
    db.session.add(run)
    db.session.flush()

    for res in results:
        fr = ForecastResult(
            forecast_run_id=run.id,
            municipality_id=municipality_id,
            forecast_period=res["forecast_period"],
            forecast_production=res["forecast_production"],
            lower_bound=res["lower_bound"],
            upper_bound=res["upper_bound"],
            trend_direction=res["trend_direction"],
        )
        db.session.add(fr)

    db.session.commit()

    return {
        "run_id": run.id,
        "model_name": model_name,
        "municipality_name": m.name,
        "metrics": metrics,
        "results": results,
    }


def _group_by_period(records):
    grouped = {}
    for r in records:
        ptype = r.period_type
        if ptype not in grouped:
            grouped[ptype] = []
        grouped[ptype].append(r)
    return grouped


def _fit_model(model_name, x, y):
    if model_name == "linear_regression":
        model = LinearRegression()
        model.fit(x, y)
        y_pred = model.predict(x)
        metrics = _compute_metrics(y, y_pred)
        future_x = np.arange(len(y), len(y) + 3).reshape(-1, 1)
        forecast = model.predict(future_x).tolist()
        return forecast, metrics

    elif model_name == "random_forest":
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(x, y.ravel())
        y_pred = model.predict(x)
        metrics = _compute_metrics(y, y_pred)
        future_x = np.arange(len(y), len(y) + 3).reshape(-1, 1)
        forecast = model.predict(future_x).tolist()
        return forecast, metrics

    elif model_name == "arima":
        try:
            from statsmodels.tsa.arima.model import ARIMA
            model = ARIMA(y, order=(1, 1, 1))
            fitted = model.fit()
            y_pred = fitted.fittedvalues
            metrics = _compute_metrics(y, y_pred)
            forecast_result = fitted.forecast(steps=3)
            forecast = forecast_result.tolist()
            return forecast, metrics
        except Exception:
            trend = _simple_trend(y)
            forecast = [trend * (i + 1) + y[-1] for i in range(3)]
            metrics = {"mae": 0, "rmse": 0, "mape": 0, "r_squared": 0}
            return forecast, metrics

    return None, {}


def _compute_metrics(y_true, y_pred):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mape = np.mean(np.abs((y_true - y_pred) / np.where(y_true == 0, 1, y_true))) * 100
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
    return {"mae": mae, "rmse": rmse, "mape": mape, "r_squared": r_squared}


def _simple_trend(y):
    if len(y) < 2:
        return 0
    return (y[-1] - y[0]) / len(y)


def _determine_trend(forecast_values):
    if len(forecast_values) < 2:
        return "stable"
    if forecast_values[-1] > forecast_values[0]:
        return "increasing"
    elif forecast_values[-1] < forecast_values[0]:
        return "declining"
    return "stable"


def _add_months(d, months):
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)
