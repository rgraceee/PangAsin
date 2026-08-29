from app.extensions import db
from datetime import datetime


class ReportFile(db.Model):
    __tablename__ = "report_files"

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("reports.id"), nullable=False)
    file_format = db.Column(db.Enum("pdf", "excel", name="report_format"), nullable=False)
    file_url = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
