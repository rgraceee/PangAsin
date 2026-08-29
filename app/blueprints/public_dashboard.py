from flask import Blueprint, render_template
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality
from app.models.demand_benchmark import DemandBenchmark
from app.extensions import db

public_dashboard_bp = Blueprint("public_dashboard", __name__)


@public_dashboard_bp.route("/dashboard")
def dashboard():
    approved = ProductionRecord.query.filter_by(status="approved").all()
    total_production = sum(float(r.production_volume) for r in approved)
    active_municipalities = db.session.query(ProductionRecord.municipality_id).filter_by(status="approved").distinct().count()
    avg_production = total_production / len(approved) if approved else 0

    methods = {}
    for r in approved:
        methods[r.production_method] = methods.get(r.production_method, 0) + float(r.production_volume)
    total_method = sum(methods.values()) if methods else 1
    method_labels = list(methods.keys())
    method_data = [round(v / total_method * 100, 1) for v in methods.values()]

    muni_totals = {}
    for r in approved:
        muni_totals[r.municipality_id] = muni_totals.get(r.municipality_id, 0) + float(r.production_volume)
    sorted_munis = sorted(muni_totals.items(), key=lambda x: x[1], reverse=True)
    top_municipality = Municipality.query.get(sorted_munis[0][0]) if sorted_munis else None
    municipality_labels = [Municipality.query.get(mid).name for mid, _ in sorted_munis[:5]]
    municipality_data = [total for _, total in sorted_munis[:5]]

    benchmark = DemandBenchmark.query.order_by(DemandBenchmark.year.desc()).first()
    supply_sufficiency = round(total_production / float(benchmark.demand_volume) * 100, 1) if benchmark and benchmark.demand_volume else 0
    supply_value = total_production
    demand_value = float(benchmark.demand_volume) if benchmark else 0
    show_supply_demand = benchmark is not None

    return render_template(
        "public/dashboard.html",
        total_production=total_production,
        active_municipalities=active_municipalities,
        avg_production=avg_production,
        top_municipality=top_municipality,
        method_labels=method_labels,
        method_data=method_data,
        municipality_labels=municipality_labels,
        municipality_data=municipality_data,
        supply_value=supply_value,
        demand_value=demand_value,
        show_supply_demand=show_supply_demand,
    )


