from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models.production_record import ProductionRecord
from app.extensions import db

monitoring_bp = Blueprint("monitoring", __name__)


@monitoring_bp.route("/")
def landing():
    approved = ProductionRecord.query.filter_by(status="approved").all()
    total_production = sum(float(r.production_volume) for r in approved)
    municipalities_count = db.session.query(ProductionRecord.municipality_id).filter_by(status="approved").distinct().count()
    return render_template("public/landing.html", total_production=total_production, municipalities_count=municipalities_count, records=approved)


@monitoring_bp.route("/reports")
def reports():
    from app.models.report import Report
    reports = Report.query.filter_by(status="generated").order_by(Report.created_at.desc()).all()
    return render_template("public/reports.html", reports=reports)
