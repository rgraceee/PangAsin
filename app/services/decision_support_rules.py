from app.models.production_record import ProductionRecord
from app.models.forecast_snapshot import ForecastSnapshot
from app.services.forecast_readiness import get_readiness
from app.extensions import db


def get_insights(municipality_id=None):
    insights = []

    if municipality_id:
        readiness = get_readiness(municipality_id)
        if readiness["status"] in ("not_ready", "limited"):
            from app.models.municipality import Municipality
            m = Municipality.query.get(municipality_id)
            name = m.name if m else "This municipality"
            insights.append({
                "level": "error",
                "message": f"{name} has insufficient validated records. Forecast results should be interpreted with caution.",
            })
    else:
        from app.models.municipality import Municipality
        provincial_total = 0
        for m in Municipality.query.all():
            readiness = get_readiness(m.id)
            if readiness["status"] in ("not_ready", "limited"):
                insights.append({
                    "level": "error",
                    "message": f"{m.name} has insufficient validated records. Forecast results should be interpreted with caution.",
                })

    if municipality_id:
        snap = ForecastSnapshot.query.filter_by(municipality_id=municipality_id).order_by(ForecastSnapshot.generated_at.desc()).first()
        if snap and snap.growth_rate > 5:
            from app.models.municipality import Municipality
            m = Municipality.query.get(municipality_id)
            name = m.name if m else "This municipality"
            insights.append({
                "level": "success",
                "message": f"{name} shows strong production growth. Consider prioritizing for expansion support.",
            })

    from app.models.municipality import Municipality
    total_production = db.session.query(db.func.sum(ProductionRecord.production_volume)).filter_by(status="approved").scalar() or 0
    national_demand = 500000
    if total_production < national_demand:
        insights.append({
            "level": "warning",
            "message": "Projected production remains below estimated demand, indicating continued reliance on imported salt.",
        })

    return insights
