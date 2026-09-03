from app.extensions import db
from datetime import datetime

PRODUCTION_METHODS = ("solar", "cooked", "hybrid")


class ProductionRecord(db.Model):
    __tablename__ = "production_records"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=False)
    barangay_id = db.Column(db.Integer, db.ForeignKey("barangays.id"), nullable=False, index=True)
    record_date = db.Column(db.Date, nullable=False)
    production_volume = db.Column(db.Numeric(12, 2), nullable=False)
    num_salt_beds = db.Column(db.Integer, nullable=False)
    area_per_salt_bed = db.Column(db.Numeric(10, 2), nullable=True)
    registered_producers = db.Column(db.Integer, nullable=False, default=0)
    male_producers = db.Column(db.Integer, nullable=False, default=0)
    female_producers = db.Column(db.Integer, nullable=False, default=0)
    production_method = db.Column(
        db.Enum(*PRODUCTION_METHODS, name="production_method_enum"),
        nullable=False,
        default="solar",
    )
    status = db.Column(db.Enum("draft", "pending", "approved", "rejected", "returned", name="record_status_enum"), default="draft", nullable=False)
    reviewer_comment = db.Column(db.Text, nullable=True)
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    reviewer = db.relationship("User", foreign_keys=[reviewed_by], backref="reviewed_records", lazy=True)
    barangay = db.relationship("Barangay", foreign_keys=[barangay_id], lazy=True)

    __table_args__ = (
        db.UniqueConstraint("municipality_id", "barangay_id", "record_date", name="uq_production_records_barangay_date"),
        db.CheckConstraint("production_volume >= 0", name="chk_production_volume"),
        db.CheckConstraint("num_salt_beds > 0", name="chk_num_salt_beds"),
        db.CheckConstraint("registered_producers >= 0", name="chk_registered_producers"),
        db.CheckConstraint("male_producers >= 0", name="chk_male_producers"),
        db.CheckConstraint("female_producers >= 0", name="chk_female_producers"),
        db.CheckConstraint("area_per_salt_bed IS NULL OR area_per_salt_bed >= 0", name="chk_area_per_salt_bed"),
    )
