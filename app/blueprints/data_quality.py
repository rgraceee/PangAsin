from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.services.data_quality_metrics import compute_all

data_quality_bp = Blueprint("data_quality", __name__)


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        return False
    return True


@data_quality_bp.before_request
def require_admin():
    if not admin_required():
        from flask import redirect, url_for, flash
        flash("Admin access required.", "danger")
        return redirect(url_for("monitoring.landing"))


@data_quality_bp.route("/admin/data-quality")
@login_required
def data_quality():
    metrics = compute_all()
    return render_template("admin/data_quality.html", metrics=metrics)
