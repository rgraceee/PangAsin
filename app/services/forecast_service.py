from datetime import date, timedelta
from typing import List, Optional

import numpy as np
from sklearn.linear_model import LinearRegression

from app.extensions import db
from app.models.forecast import ForecastRun, ForecastPoint
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality


def _monthly_aggregates(municipality_id: Optional[int], start: date, end: date):
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
    for r in rows:
        labels.append(r.month.date().isoformat()[:7])
        values.append(float(r.volume or 0))
    return labels, values


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


def run_forecast(municipality_id: Optional[int], period_start: date, period_end: date, forecast_horizon: int = 12):
    hist_start = period_start - timedelta(days=365 * 3)
    labels, values = _monthly_aggregates(municipality_id, hist_start, period_end)
    readiness = _readiness(labels)

    run = ForecastRun(
        municipality_id=municipality_id,
        period_start=period_start,
        period_end=period_end,
        readiness=readiness,
    )
    db.session.add(run)
    db.session.flush()

    if readiness == "not_ready" or not values:
        run.reliability = "low"
        run.trend_direction = "stable"
        run.expected_change_pct = None
        run.projected_total = None
        db.session.commit()
        return run

    x = np.arange(len(values)).reshape(-1, 1)
    y = np.array(values, dtype=float)
    model = LinearRegression().fit(x, y)
    slope = float(model.coef_[0])
    monthly_avg = float(np.mean(y)) if len(y) else 0.0

    slope_pct = (slope / monthly_avg * 100.0) if monthly_avg != 0 else 0.0
    trend = _trend_direction(slope_pct)

    future_x = np.arange(len(values), len(values) + forecast_horizon).reshape(-1, 1)
    preds = model.predict(future_x)

    residuals = y - model.predict(x)
    if len(residuals) > 1:
        std_err = float(np.std(residuals, ddof=1))
    else:
        std_err = float(np.std(y)) * 0.5 if len(y) else monthly_avg * 0.2
    std_err = max(std_err, monthly_avg * 0.05)

    all_labels = labels + [_next_month_label(labels[-1] if labels else period_start.isoformat()[:7], i + 1) for i in range(forecast_horizon)]
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

    run.reliability = _reliability(readiness, len(values))
    run.trend_direction = trend
    run.expected_change_pct = expected
    run.projected_total = projected
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
                "last_run_at": latest_run.created_at.isoformat() + "Z" if latest_run.created_at else None,
            })
        else:
            labels, values = _monthly_aggregates(m.id, date(2020, 1, 1), date.today())
            readiness = _readiness(labels)
            results.append({
                "municipality_id": m.id,
                "municipality_name": m.name,
                "trend_direction": "stable",
                "expected_change_pct": None,
                "readiness": readiness,
                "reliability": _reliability(readiness, len(labels)),
                "last_run_at": None,
            })
    return results
