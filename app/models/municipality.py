# WHAT: Municipality table — isang bayan sa Pangasinan (7 salt-producing areas).
# WHY: Reference ng bawat production record; ang geojson_ref ang link sa map boundary.
from app.extensions import db
from datetime import datetime


class Municipality(db.Model):
    __tablename__ = "municipalities"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Numeric(9, 6), nullable=False)
    longitude = db.Column(db.Numeric(9, 6), nullable=False)
    geojson_ref = db.Column(db.String(255), nullable=True)
    status = db.Column(db.Enum("active", "inactive", name="municipality_status_enum"), default="active", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    users = db.relationship("User", backref="municipality", lazy=True)
    barangays = db.relationship("Barangay", backref="municipality", lazy=True)
    production_records = db.relationship("ProductionRecord", backref="municipality", lazy=True)