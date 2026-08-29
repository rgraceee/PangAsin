from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality
from app.extensions import db

trends_bp = Blueprint("trends", __name__)


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        return False
    return True


@trends_bp.before_request
def require_admin():
    if not admin_required():
        from flask import redirect, url_for, flash
        flash("Admin access required.", "danger")
        return redirect(url_for("monitoring.landing"))


@trends_bp.route("/admin/trends")
@login_required
def trends():
    approved = ProductionRecord.query.filter_by(status="approved").order_by(ProductionRecord.record_date).all()
    trend_data = {}
    for r in approved:
        key = r.record_date.strftime("%Y-%m") if hasattr(r.record_date, 'strftime') else str(r.record_date)
        trend_data[key] = trend_data.get(key, 0) + float(r.production_volume)

    trend_labels = sorted(trend_data.keys())
    trend_datasets = [{"label": "Production", "data": [round(trend_data[k], 2) for k in trend_labels], "borderColor": "#198754"}]

    monthly_avg = {}
    monthly_counts = {}
    for r in approved:
        month = r.record_date.month if hasattr(r.record_date, 'month') else 1
        monthly_avg[month] = monthly_avg.get(month, 0) + float(r.production_volume)
        monthly_counts[month] = monthly_counts.get(month, 0) + 1
    seasonal_labels = [f"Month {m}" for m in sorted(monthly_avg.keys())]
    seasonal_data = [round(monthly_avg[m] / monthly_counts[m], 2) for m in sorted(monthly_avg.keys())]

    return render_template(
        "admin/trends.html",
        trend_labels=trend_labels,
        trend_datasets=trend_datasets,
        seasonal_labels=seasonal_labels,
        seasonal_data=seasonal_data,
    )
