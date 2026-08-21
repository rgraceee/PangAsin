from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality
from app.services.decision_support_rules import get_insights
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
    return render_template("admin/municipality_analytics.html", municipality=m, records=records, insights=insights)


@analytics_bp.route("/admin/supply-demand")
@login_required
def supply_demand():
    return render_template("admin/supply_demand.html")
