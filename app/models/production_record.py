from app.extensions import db
from datetime import datetime


class ProductionRecord(db.Model):
    __tablename__ = "production_records"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=False)
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    period_type = db.Column(db.Enum("daily", "monthly", "annual", name="period_type"), nullable=False)
    record_date = db.Column(db.Date, nullable=False)
    barangay = db.Column(db.String(120), nullable=False)
    production_volume = db.Column(db.Numeric(12, 2), nullable=False)
    production_method = db.Column(db.Enum("solar_evaporation", "cooked", "hybrid", name="production_method"), nullable=False)
    production_area = db.Column(db.Numeric(10, 2), nullable=False)
    num_salt_beds = db.Column(db.Integer, nullable=False)
    producer_age = db.Column(db.Integer, nullable=True)
    producer_gender = db.Column(db.String(20), nullable=True)
    status = db.Column(db.Enum("draft", "pending", "approved", "rejected", "returned", name="record_status"), default="draft", nullable=False)
    reviewer_comment = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reviewer = db.relationship("User", foreign_keys=[reviewed_by], backref="reviewed_records")
