from flask import Blueprint, render_template

monitoring_bp = Blueprint("monitoring", __name__)


@monitoring_bp.route("/")
def landing():
    return render_template("public/landing.html")


@monitoring_bp.route("/reports")
def reports():
    from app.models.report import Report
    reports = Report.query.filter_by(status="generated").order_by(Report.created_at.desc()).all()
    return render_template("public/reports.html", reports=reports)
