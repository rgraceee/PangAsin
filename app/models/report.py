from app.extensions import db
from datetime import datetime


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    report_type = db.Column(db.Enum("provincial", "municipality", "forecast", "data_quality", "supply_demand", "gis", name="report_type"), nullable=False)
    requested_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=True)
    date_range_start = db.Column(db.Date, nullable=True)
    date_range_end = db.Column(db.Date, nullable=True)
    status = db.Column(db.Enum("pending", "generated", "failed", name="report_status"), default="pending", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    generated_at = db.Column(db.DateTime, nullable=True)

    report_files = db.relationship("ReportFile", backref="report", lazy=True, cascade="all, delete-orphan")
