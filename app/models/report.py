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
    format = db.Column(db.Enum("pdf", "excel", name="report_format"), nullable=False)
    status = db.Column(db.Enum("pending", "generated", "failed", name="report_status"), default="pending", nullable=False)
    file_url = db.Column(db.String(255), nullable=True)
    generated_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    requester = db.relationship("User", backref="reports")
