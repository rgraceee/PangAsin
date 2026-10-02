from datetime import datetime

from app.extensions import db


PRODUCER_REPORT_STATUSES = ("draft", "pending", "approved", "rejected", "returned")


class ProducerReport(db.Model):
    __tablename__ = "producer_reports"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(
        db.Integer,
        db.ForeignKey("municipalities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    submitted_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status = db.Column(
        db.Enum(*PRODUCER_REPORT_STATUSES, name="producer_report_status_enum"),
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
    entries = db.relationship(
        "ProducerReportEntry",
        backref="report",
        cascade="all, delete-orphan",
        order_by="ProducerReportEntry.id",
        lazy=True,
    )


class ProducerReportEntry(db.Model):
    __tablename__ = "producer_report_entries"

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(
        db.Integer,
        db.ForeignKey("producer_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    barangay_id = db.Column(
        db.Integer,
        db.ForeignKey("barangays.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name = db.Column(db.String(150), nullable=False)
    age = db.Column(db.Integer, nullable=True)
    age_bracket = db.Column(db.String(16), nullable=True)
    sex = db.Column(db.String(20), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    barangay = db.relationship("Barangay", lazy=True)
