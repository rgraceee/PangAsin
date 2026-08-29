from flask import Blueprint, render_template, request
from flask_login import login_required, current_user
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality
from app.extensions import db

comparison_bp = Blueprint("comparison", __name__)


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        return False
    return True


@comparison_bp.before_request
def require_admin():
    if not admin_required():
        from flask import redirect, url_for, flash
        flash("Admin access required.", "danger")
        return redirect(url_for("monitoring.landing"))


@comparison_bp.route("/admin/comparison")
@login_required
def comparison():
    selected_ids = request.args.getlist("municipality_ids", type=int)
    municipalities = Municipality.query.filter_by(status="active").all()
    selected = []
    if selected_ids:
        selected = Municipality.query.filter(Municipality.id.in_(selected_ids)).all()
    elif municipalities:
        selected = municipalities[:2]
    comparison_data = []
    for m in selected:
        records = ProductionRecord.query.filter_by(municipality_id=m.id, status="approved").all()
        total = sum(float(r.production_volume) for r in records)
        area = sum(float(r.production_area) for r in records if r.production_area)
        comparison_data.append({"municipality": m, "total_production": total, "production_area": area, "records_count": len(records)})

    comparison_labels = [c["municipality"].name for c in comparison_data]
    comparison_volumes = [round(c["total_production"], 2) for c in comparison_data]
    comparison_efficiency = [round(c["total_production"] / c["production_area"], 2) if c["production_area"] else 0 for c in comparison_data]

    return render_template(
        "admin/comparison.html",
        municipalities=municipalities,
        selected=selected_ids,
        comparison_data=comparison_data,
        comparison_labels=comparison_labels,
        comparison_volumes=comparison_volumes,
        comparison_efficiency=comparison_efficiency,
    )
