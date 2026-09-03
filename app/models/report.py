from app.extensions import db
from datetime import datetime


REPORT_TYPES = (
    "provincial",
    "municipality",
    "forecast",
    "data_quality",
    "supply_demand",
    "gis",
)

REPORT_FORMATS = ("pdf", "excel")
REPORT_STATUSES = ("pending", "generated", "failed")


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    report_type = db.Column(
        db.Enum(*REPORT_TYPES, name="report_type_enum"),
        nullable=False,
    )
    requested_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    municipality_id = db.Column(
        db.Integer,
        db.ForeignKey("municipalities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    date_range_start = db.Column(db.Date, nullable=True)
    date_range_end = db.Column(db.Date, nullable=True)
    format = db.Column(
        db.Enum(*REPORT_FORMATS, name="report_format_enum"),
        nullable=False,
    )
    status = db.Column(
        db.Enum(*REPORT_STATUSES, name="report_status_enum"),
        nullable=False,
        default="pending",
    )
    file_url = db.Column(db.String(255), nullable=True)
    generated_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)
    updated_at = db.Column(
        db.DateTime,
        server_default=db.func.now(),
        onupdate=datetime.utcnow,
        nullable=False,
    )

    requester = db.relationship("User", foreign_keys=[requested_by])
    municipality = db.relationship("Municipality", foreign_keys=[municipality_id])

    def serialize(self):
        return {
            "id": self.id,
            "report_type": self.report_type,
            "requested_by": self.requested_by,
            "requester_name": self.requester.name if self.requester else None,
            "municipality_id": self.municipality_id,
            "municipality_name": self.municipality.name if self.municipality else None,
            "date_range_start": self.date_range_start.isoformat() if self.date_range_start else None,
            "date_range_end": self.date_range_end.isoformat() if self.date_range_end else None,
            "format": self.format,
            "status": self.status,
            "file_url": self.file_url,
            "generated_at": self.generated_at.isoformat() + "Z" if self.generated_at else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }
