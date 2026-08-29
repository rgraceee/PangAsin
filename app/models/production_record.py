from app.extensions import db
from datetime import datetime


class ProductionRecord(db.Model):
    __tablename__ = "production_records"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=False)
    submission_batch_id = db.Column(db.Integer, db.ForeignKey("submission_batches.id"), nullable=True)
    barangay = db.Column(db.String(100), nullable=True)
    period_type = db.Column(db.Enum("daily", "monthly", "annual", name="period_type"), nullable=False)
    record_date = db.Column(db.Date, nullable=False)
    production_volume = db.Column(db.Numeric(12, 2), nullable=False)
    production_method = db.Column(db.Enum("solar_evaporation", "cooked", "hybrid", name="production_method"), nullable=False)
    production_area = db.Column(db.Numeric(10, 2), nullable=True)
    num_salt_beds = db.Column(db.Integer, nullable=True)
    producer_age = db.Column(db.SmallInteger, nullable=True)
    producer_gender = db.Column(db.Enum("male", "female", "other", name="producer_gender"), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.Enum("draft", "pending", "approved", "rejected", name="record_status"), default="draft", nullable=False)
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    submitted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    submission_batch = db.relationship("SubmissionBatch", backref="production_records", lazy=True)
    validation_histories = db.relationship("ValidationHistory", backref="production_record", lazy=True, cascade="all, delete-orphan")

    __table_args__ = (
        db.CheckConstraint("production_volume >= 0", name="ck_production_volume_positive"),
        db.CheckConstraint("production_area IS NULL OR production_area > 0", name="ck_production_area_positive"),
        db.CheckConstraint("num_salt_beds IS NULL OR num_salt_beds > 0", name="ck_salt_beds_positive"),
        db.CheckConstraint("producer_age IS NULL OR (producer_age >= 15 AND producer_age <= 100)", name="ck_producer_age_range"),
    )
