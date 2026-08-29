from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models.municipality import Municipality
from app.models.forecast_run import ForecastRun
from app.models.forecast_result import ForecastResult
from app.services.forecasting import run_forecast
from app.services.forecast_readiness import get_readiness
from app.services.insight_engine import get_insights

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
    forecast_run = None
    forecast_results = None
    readiness = None
    if selected_id:
        selected = Municipality.query.get(selected_id)
        forecast_run = ForecastRun.query.filter_by(municipality_id=selected_id).order_by(ForecastRun.generated_at.desc()).first()
        if forecast_run:
            forecast_results = ForecastResult.query.filter_by(forecast_run_id=forecast_run.id).order_by(ForecastResult.forecast_period).all()
        readiness = get_readiness(selected_id)
    insights = get_insights(selected_id)
    outlooks = []
    for m in municipalities:
        fr = ForecastRun.query.filter_by(municipality_id=m.id).order_by(ForecastRun.generated_at.desc()).first()
        outlooks.append({"municipality": m, "forecast_run": fr})
    forecast_labels = []
    forecast_data = []
    if forecast_results:
        forecast_labels = [str(r.forecast_period) for r in forecast_results]
        forecast_data = [round(float(r.forecast_production), 2) for r in forecast_results]

    return render_template("admin/forecasting.html", municipalities=municipalities, selected=selected, forecast_run=forecast_run, forecast_results=forecast_results, readiness=readiness, insights=insights, outlooks=outlooks, forecast_labels=forecast_labels, forecast_data=forecast_data)


@forecasting_bp.route("/admin/forecasting/generate", methods=["POST"])
@login_required
def generate_forecast():
    municipality_id = request.form.get("municipality_id", type=int)
    model_name = request.form.get("model_name", "random_forest")
    if not municipality_id:
        flash("Select a municipality.", "danger")
        return redirect(url_for("forecasting.forecasting"))
    run_forecast(municipality_id, model_name=model_name, user_id=current_user.id)
    flash("Forecast generated.", "success")
    return redirect(url_for("forecasting.forecasting", municipality_id=municipality_id))
