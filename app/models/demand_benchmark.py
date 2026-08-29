from app.extensions import db
from datetime import datetime


class DemandBenchmark(db.Model):
    __tablename__ = "demand_benchmarks"

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.SmallInteger, nullable=False)
    geographic_scope = db.Column(db.Enum("national", "provincial", name="geographic_scope"), nullable=False)
    demand_volume = db.Column(db.Numeric(14, 2), nullable=False)
    local_production = db.Column(db.Numeric(14, 2), nullable=True)
    import_volume = db.Column(db.Numeric(14, 2), nullable=True)
    source_name = db.Column(db.String(255), nullable=False)
    source_reference = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
