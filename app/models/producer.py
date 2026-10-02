from datetime import datetime

from app.extensions import db


class Producer(db.Model):
    __tablename__ = "producers"

    id = db.Column(db.Integer, primary_key=True)
    barangay_id = db.Column(
        db.Integer,
        db.ForeignKey("barangays.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name = db.Column(db.String(150), nullable=False, index=True)
    age = db.Column(db.Integer, nullable=True)
    age_bracket = db.Column(db.String(16), nullable=True)
    sex = db.Column(db.String(20), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    barangay = db.relationship("Barangay", lazy=True)
