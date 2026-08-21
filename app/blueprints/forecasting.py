from flask import Blueprint, render_template, request
from flask_login import login_required, current_user
from app.models.municipality import Municipality
from app.models.forecast_snapshot import ForecastSnapshot
from app.services.forecasting_stub import generate as stub_generate
from app.services.forecast_readiness import get_readiness
from app.services.decision_support_rules import get_insights

forecasting_bp = Blueprint("forecasting", __name__)


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        return False
    return True


@forecasting_bp.before_request
def require_admin():
    if not admin_required():
        from flask import redirect, url_for, flash
        flash("Admin access required.", "danger")
        return redirect(url_for("monitoring.landing"))


@forecasting_bp.route("/admin/forecasting")
@login_required
def forecasting():
    selected_id = request.args.get("municipality_id", type=int)
    municipalities = Municipality.query.order_by(Municipality.name).all()
    selected = None
    forecast = None
    readiness = None
    if selected_id:
        selected = Municipality.query.get(selected_id)
        forecast = ForecastSnapshot.query.filter_by(municipality_id=selected_id).order_by(ForecastSnapshot.generated_at.desc()).first()
        readiness = get_readiness(selected_id)
    insights = get_insights(selected_id)
    outlooks = []
    for m in municipalities:
        snap = ForecastSnapshot.query.filter_by(municipality_id=m.id).order_by(ForecastSnapshot.generated_at.desc()).first()
        outlooks.append({"municipality": m, "snapshot": snap})
    return render_template("admin/forecasting.html", municipalities=municipalities, selected=selected, forecast=forecast, readiness=readiness, insights=insights, outlooks=outlooks)
