# WHAT: ProductionRecord table — buwanang record ng asin production ng isang barangay.
# WHY: Core data ng buong system; may lifecycle: pending -> approved/rejected.
from app.extensions import db
from app.status_constants import ALLOWED_STATUSES
from datetime import datetime

PRODUCTION_METHODS = ("solar", "cooked", "hybrid")


class ProductionRecord(db.Model):
    __tablename__ = "production_records"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=False)
    barangay_id = db.Column(db.Integer, db.ForeignKey("barangays.id"), nullable=False, index=True)
    record_date = db.Column(db.Date, nullable=False)
    production_volume_mt = db.Column(db.Numeric(12, 5), nullable=False)
    num_salt_beds = db.Column(db.Integer, nullable=False)
    area_per_salt_bed = db.Column(db.Numeric(10, 2), nullable=True)
    registered_producers = db.Column(db.Integer, nullable=False, default=0)
    male_producers = db.Column(db.Integer, nullable=False, default=0)
    female_producers = db.Column(db.Integer, nullable=False, default=0)
    producers_18_30 = db.Column(db.Integer, nullable=False, default=0)
    producers_31_40 = db.Column(db.Integer, nullable=False, default=0)
    producers_41_50 = db.Column(db.Integer, nullable=False, default=0)
    producers_51_60 = db.Column(db.Integer, nullable=False, default=0)
    producers_61_plus = db.Column(db.Integer, nullable=False, default=0)
    production_method = db.Column(
        db.Enum(*PRODUCTION_METHODS, name="production_method_enum"),
        nullable=False,
        default="solar",
    )
    status = db.Column(db.Enum(*ALLOWED_STATUSES, name="record_status_enum"), default="pending", nullable=False)
    reviewer_comment = db.Column(db.Text, nullable=True)
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    # WHAT: Soft-delete columns so a SuperAdmin can remove bad data without
    #       destroying history. Queries must filter deleted_at IS NULL.
    deleted_at = db.Column(db.DateTime, nullable=True)
    deleted_by = db.Column(db.Integer, nullable=True)

    reviewer = db.relationship("User", foreign_keys=[reviewed_by], backref="reviewed_records", lazy=True)
    barangay = db.relationship("Barangay", foreign_keys=[barangay_id], lazy=True)

    @classmethod
    def active(cls):
        """Return a query excluding soft-deleted records (deleted_at IS NULL).

        Every read path on production records must use this so deleted rows
        vanish from dashboards, forecasts, reports, validation queue and the
        public API while history is preserved.
        """
        return cls.query.filter(cls.deleted_at.is_(None))

    def soft_delete(self, actor_id):
        self.deleted_at = datetime.utcnow()
        self.deleted_by = actor_id
        db.session.add(self)

    def restore(self):
        self.deleted_at = None
        self.deleted_by = None
        db.session.add(self)

    def permanent_delete(self):
        """Hard-delete the row from the database. Only for already soft-deleted records."""
        db.session.delete(self)

    __table_args__ = (
        db.UniqueConstraint("municipality_id", "barangay_id", "record_date", name="uq_production_records_barangay_date"),
        db.CheckConstraint("production_volume_mt >= 0", name="chk_production_volume_mt"),
        db.CheckConstraint("num_salt_beds > 0", name="chk_num_salt_beds"),
        db.CheckConstraint("registered_producers >= 0", name="chk_registered_producers"),
        db.CheckConstraint("male_producers >= 0", name="chk_male_producers"),
        db.CheckConstraint("female_producers >= 0", name="chk_female_producers"),
        db.CheckConstraint("producers_18_30 >= 0", name="chk_producers_18_30"),
        db.CheckConstraint("producers_31_40 >= 0", name="chk_producers_31_40"),
        db.CheckConstraint("producers_41_50 >= 0", name="chk_producers_41_50"),
        db.CheckConstraint("producers_51_60 >= 0", name="chk_producers_51_60"),
        db.CheckConstraint("producers_61_plus >= 0", name="chk_producers_61_plus"),
        db.CheckConstraint("area_per_salt_bed IS NULL OR area_per_salt_bed >= 0", name="chk_area_per_salt_bed"),
    )
