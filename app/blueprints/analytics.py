from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality
from app.services.insight_engine import get_insights
from app.extensions import db

analytics_bp = Blueprint("analytics", __name__)


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        return False
    return True


@analytics_bp.before_request
def require_admin():
    if not admin_required():
        from flask import redirect, url_for, flash
        flash("Admin access required.", "danger")
        return redirect(url_for("monitoring.landing"))


@analytics_bp.route("/admin/analytics/<int:municipality_id>")
@login_required
def municipality_analytics(municipality_id):
    m = Municipality.query.get_or_404(municipality_id)
    records = ProductionRecord.query.filter_by(municipality_id=municipality_id, status="approved").all()
    insights = get_insights(municipality_id)

    total_production = sum(float(r.production_volume) for r in records)
    areas = [float(r.production_area) for r in records if r.production_area]
    avg_per_ha = round(total_production / sum(areas), 2) if areas else 0
    beds = [int(r.num_salt_beds) for r in records if r.num_salt_beds]
    avg_per_bed = round(total_production / sum(beds), 2) if beds else 0
    active_producers = len([r for r in records if r.producer_age])

    history = {}
    for r in records:
        key = r.record_date.strftime("%Y-%m") if hasattr(r.record_date, 'strftime') else str(r.record_date)
        history[key] = history.get(key, 0) + float(r.production_volume)
    history_labels = sorted(history.keys())
    history_data = [round(history[k], 2) for k in history_labels]

    methods = {}
    for r in records:
        methods[r.production_method] = methods.get(r.production_method, 0) + float(r.production_volume)
    method_labels = list(methods.keys())
    method_data = [round(v, 2) for v in methods.values()]

    ages = {}
    for r in records:
        if r.producer_age:
            ages[r.producer_age] = ages.get(r.producer_age, 0) + 1
    demographic_labels = sorted(ages.keys())
    demographic_data = [ages[a] for a in demographic_labels]

    return render_template(
        "admin/municipality_analytics.html",
        municipality=m,
        records=records,
        insights=insights,
        total_production=round(total_production, 2),
        avg_per_ha=avg_per_ha,
        avg_per_bed=avg_per_bed,
        active_producers=active_producers,
        history_labels=history_labels,
        history_data=history_data,
        method_labels=method_labels,
        method_data=method_data,
        demographic_labels=[str(x) for x in demographic_labels],
        demographic_data=demographic_data,
    )


@analytics_bp.route("/admin/supply-demand")
@login_required
def supply_demand():
    from app.models.demand_benchmark import DemandBenchmark
    benchmarks = DemandBenchmark.query.order_by(DemandBenchmark.year.desc()).all()
    approved = ProductionRecord.query.filter_by(status="approved").all()
    total_production = sum(float(r.production_volume) for r in approved)

    latest = benchmarks[0] if benchmarks else None
    demand = float(latest.demand_volume) if latest else 0
    sufficiency_rate = round(total_production / demand * 100, 1) if demand else 0
    shortage_surplus = round(total_production - demand, 2)

    muni_totals = {}
    for r in approved:
        muni_totals[r.municipality_id] = muni_totals.get(r.municipality_id, 0) + float(r.production_volume)
    total_all = sum(muni_totals.values())
    top_muni = max(muni_totals, key=muni_totals.get) if muni_totals else None
    contribution_pct = round(muni_totals.get(top_muni, 0) / total_all * 100, 1) if total_all else 0

    supply_labels = ["Supply", "Demand"]
    supply_data = [round(total_production, 2)]
    demand_data = [round(demand, 2)]

    insights = get_insights()
    return render_template(
        "admin/supply_demand.html",
        benchmarks=benchmarks,
        total_production=round(total_production, 2),
        insights=insights,
        sufficiency_rate=sufficiency_rate,
        shortage_surplus=shortage_surplus,
        contribution_pct=contribution_pct,
        supply_labels=supply_labels,
        supply_data=supply_data,
        demand_data=demand_data,
    )
