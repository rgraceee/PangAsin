from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models.municipality import Municipality
from app.models.production_record import ProductionRecord
from app.services.insight_engine import get_insights
from app.extensions import db

map_insights_bp = Blueprint("map_insights", __name__)


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        return False
    return True


@map_insights_bp.before_request
def require_admin():
    if not admin_required():
        from flask import redirect, url_for, flash
        flash("Admin access required.", "danger")
        return redirect(url_for("monitoring.landing"))


@map_insights_bp.route("/admin/map-insights")
@login_required
def map_insights():
    municipalities = Municipality.query.filter_by(status="active").all()
    ranking = []
    for m in municipalities:
        records = ProductionRecord.query.filter_by(municipality_id=m.id, status="approved").all()
        total = sum(float(r.production_volume) for r in records)
        ranking.append({"municipality": m, "total_production": total, "records_count": len(records)})
    ranking.sort(key=lambda x: x["total_production"], reverse=True)
    insights = get_insights()
    return render_template("admin/map_insights.html", ranking=ranking, insights=insights)
