from decimal import Decimal

from app.models.production_record import ProductionRecord
from app.models.forecast_result import ForecastResult
from app.models.demand_benchmark import DemandBenchmark
from app.models.municipality import Municipality
from app.extensions import db


def get_insights(municipality_id=None):
    insights = []

    if municipality_id is None:
        _add_provincial_insights(insights)
    else:
        _add_municipality_insights(insights, municipality_id)

    return insights


def _add_provincial_insights(insights):
    municipalities = Municipality.query.all()
    for m in municipalities:
        readiness = _get_readiness(m.id)
        if readiness["status"] in ("not_ready", "limited"):
            insights.append({
                "level": "error",
                "message": f"{m.name} has insufficient validated records. Forecast results should be interpreted with caution.",
                "category": "forecast_readiness",
            })

    total_approved = db.session.query(db.func.sum(ProductionRecord.production_volume)).filter_by(status="approved").scalar() or 0
    latest_benchmark = DemandBenchmark.query.order_by(DemandBenchmark.year.desc()).first()
    if latest_benchmark and total_approved < latest_benchmark.demand_volume:
        insights.append({
            "level": "error",
            "message": "Total approved production is below the latest national demand benchmark, indicating supply shortage.",
            "category": "supply_shortage",
        })


def _add_municipality_insights(insights, municipality_id):
    m = Municipality.query.get(municipality_id)
    if not m:
        return

    readiness = _get_readiness(municipality_id)
    if readiness["status"] in ("not_ready", "limited"):
        insights.append({
            "level": "error",
            "message": f"{m.name} has insufficient validated records. Forecast results should be interpreted with caution.",
            "category": "forecast_readiness",
        })

    approved_records = ProductionRecord.query.filter_by(municipality_id=municipality_id, status="approved").all()
    if len(approved_records) >= 2:
        approved_records.sort(key=lambda r: (r.record_date,))
        periods = {}
        for r in approved_records:
            key = r.period_type
            if key not in periods:
                periods[key] = []
            periods[key].append(r)

        preferred = ["monthly", "annual", "daily"]
        used_type = None
        for ptype in preferred:
            if ptype in periods and len(periods[ptype]) >= 2:
                used_type = ptype
                break

        if used_type:
            recs = periods[used_type]
            recs.sort(key=lambda r: r.record_date)
            if recs[-1].production_volume < recs[-2].production_volume * Decimal("0.9"):
                insights.append({
                    "level": "warning",
                    "message": f"{m.name} latest approved {used_type} production volume declined by more than 10% compared to the previous period.",
                    "category": "production_decline",
                })

    all_approved = ProductionRecord.query.filter_by(status="approved").all()
    municipality_totals = {}
    for r in all_approved:
        mid = r.municipality_id
        municipality_totals[mid] = municipality_totals.get(mid, Decimal("0")) + r.production_volume

    total_all = sum(municipality_totals.values())
    if total_all > 0:
        contributions = {mid: (val / total_all) for mid, val in municipality_totals.items()}
        sorted_contrib = sorted(contributions.items(), key=lambda x: x[1])
        if len(sorted_contrib) >= 2:
            bottom_ids = {sorted_contrib[0][0], sorted_contrib[1][0]}
            if municipality_id in bottom_ids:
                insights.append({
                    "level": "warning",
                    "message": f"{m.name} is in the bottom 2 municipalities by production contribution percentage.",
                    "category": "underperformance",
                })

    municipality_production = municipality_totals.get(municipality_id, Decimal("0"))
    latest_benchmark = DemandBenchmark.query.order_by(DemandBenchmark.year.desc()).first()
    if latest_benchmark and municipality_production < latest_benchmark.demand_volume:
        insights.append({
            "level": "error",
            "message": f"{m.name} total approved production is below the latest demand benchmark.",
            "category": "supply_shortage",
        })

    latest_result = ForecastResult.query.filter_by(municipality_id=municipality_id).order_by(ForecastResult.forecast_period.desc()).first()
    if latest_result:
        if latest_result.trend_direction == "increasing":
            insights.append({
                "level": "success",
                "message": f"{m.name} forecast trend is increasing, indicating strong production growth.",
                "category": "strong_growth",
            })


def _get_readiness(municipality_id):
    from app.services.forecast_readiness import get_readiness
    return get_readiness(municipality_id)
