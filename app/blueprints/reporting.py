from flask import Blueprint, render_template, redirect, url_for, flash
from flask_login import login_required, current_user
from app.forms.report import ReportForm
from app.models.report import Report
from app.extensions import db
from datetime import datetime

reporting_bp = Blueprint("reporting", __name__)


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        return False
    return True


@reporting_bp.before_request
def require_admin():
    if not admin_required():
        from flask import redirect, url_for, flash
        flash("Admin access required.", "danger")
        return redirect(url_for("monitoring.landing"))


@reporting_bp.route("/admin/reports")
@login_required
def reports_list():
    form = ReportForm()
    reports = Report.query.order_by(Report.created_at.desc()).all()
    return render_template("admin/reports.html", form=form, reports=reports)


@reporting_bp.route("/admin/reports/generate", methods=["POST"])
@login_required
def generate_report():
    form = ReportForm()
    if form.validate_on_submit():
        report = Report(
            report_type=form.report_type.data,
            requested_by=current_user.id,
            municipality_id=form.municipality_id.data if form.municipality_id.data != 0 else None,
            date_range_start=form.date_range_start.data,
            date_range_end=form.date_range_end.data,
            format=form.format.data,
            status="generated",
            file_url=f"/static/reports/placeholder_{form.report_type.data}.{form.format.data}",
            generated_at=datetime.utcnow(),
        )
        db.session.add(report)
        db.session.commit()
        flash("Report generated (placeholder).", "success")
    else:
        flash("Invalid report request.", "danger")
    return redirect(url_for("reporting.reports_list"))
