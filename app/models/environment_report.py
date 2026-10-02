from datetime import datetime

from app.extensions import db


ENVIRONMENT_METHODS = ("cooked", "solar", "hybrid")
ENVIRONMENT_REPORT_STATUSES = ("draft", "pending", "approved", "rejected", "returned")


class EnvironmentReport(db.Model):
    __tablename__ = "environment_reports"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(
        db.Integer,
        db.ForeignKey("municipalities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    barangay_id = db.Column(
        db.Integer,
        db.ForeignKey("barangays.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    num_salt_beds = db.Column(db.Integer, nullable=False)
    area_per_salt_bed = db.Column(db.Numeric(10, 2), nullable=False)
    production_methods = db.Column(db.JSON, nullable=False)
    production_area_size = db.Column(db.Numeric(14, 2), nullable=False)
    submitted_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status = db.Column(
        db.Enum(*ENVIRONMENT_REPORT_STATUSES, name="environment_report_status_enum"),
        nullable=False,
        default="pending",
    )
    reviewer_comment = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    submitted_at = db.Column(db.DateTime, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    barangay = db.relationship("Barangay")

    __table_args__ = (
        db.CheckConstraint("num_salt_beds > 0", name="chk_environment_salt_beds"),
        db.CheckConstraint("area_per_salt_bed >= 0", name="chk_environment_area_per_bed"),
        db.CheckConstraint("production_area_size >= 0", name="chk_environment_production_area"),
    )