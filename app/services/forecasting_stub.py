from app.models.forecast_snapshot import ForecastSnapshot
from app.extensions import db
from datetime import datetime


def generate(municipality_id):
    from app.models.production_record import ProductionRecord
    from app.models.municipality import Municipality

    m = Municipality.query.get(municipality_id)
    if not m:
        return None

    records = ProductionRecord.query.filter_by(municipality_id=municipality_id, status="approved").all()
    total = sum(float(r.production_volume) for r in records) if records else 1000.0

    import random
    growth = round(random.uniform(-2.0, 8.0), 2)
    if growth > 2:
        trend = "increasing"
    elif growth < -1:
        trend = "declining"
    else:
        trend = "stable"

    forecast = round(total * (1 + growth / 100), 2)
    capacity = round(total * 1.1, 2)

    snapshot = ForecastSnapshot(
        municipality_id=municipality_id,
        generated_at=datetime.utcnow(),
        model_version="stub-v0",
        forecast_production=forecast,
        growth_rate=growth,
        trend_direction=trend,
        production_capacity_forecast=capacity,
    )
    db.session.add(snapshot)
    db.session.commit()

    return {
        "municipality_id": municipality_id,
        "municipality_name": m.name,
        "generated_at": snapshot.generated_at,
        "model_version": snapshot.model_version,
        "forecast_production": snapshot.forecast_production,
        "growth_rate": snapshot.growth_rate,
        "trend_direction": snapshot.trend_direction,
        "production_capacity_forecast": snapshot.production_capacity_forecast,
    }
