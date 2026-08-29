from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.forms.report import ReportForm
from app.models.report import Report
from app.models.report_file import ReportFile
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
            status="generated",
            generated_at=datetime.utcnow(),
        )
        db.session.add(report)
        db.session.flush()
        for fmt in ("pdf", "excel"):
            rf = ReportFile(
                report_id=report.id,
                file_format=fmt,
                file_url=f"/static/reports/report_{report.id}_{fmt}.{fmt}",
            )
            db.session.add(rf)
        db.session.commit()
        flash("Report generated.", "success")
    else:
        flash("Invalid report request.", "danger")
    return redirect(url_for("reporting.reports_list"))


@reporting_bp.route("/admin/reports/<int:id>/preview")
@login_required
def preview_report(id):
    report = Report.query.get_or_404(id)
    return render_template("admin/report_preview.html", report=report)


@reporting_bp.route("/admin/reports/<int:id>/export/<string:format>")
@login_required
def export_report(id, format):
    report = Report.query.get_or_404(id)
    rf = ReportFile.query.filter_by(report_id=report.id, file_format=format).first()
    if rf:
        return redirect(rf.file_url)
    flash("Format not available.", "warning")
    return redirect(url_for("reporting.reports_list"))
