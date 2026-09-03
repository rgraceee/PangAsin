from app.extensions import db
from datetime import datetime


GEOGRAPHIC_SCOPES = ("national", "provincial")


class DemandBenchmark(db.Model):
    __tablename__ = "demand_benchmarks"

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.SmallInteger, nullable=False)
    geographic_scope = db.Column(
        db.Enum(*GEOGRAPHIC_SCOPES, name="geographic_scope_enum"),
        nullable=False,
    )
    demand_volume = db.Column(db.Numeric(14, 2), nullable=False)
    local_production = db.Column(db.Numeric(14, 2), nullable=True)
    import_volume = db.Column(db.Numeric(14, 2), nullable=True)
    source_name = db.Column(db.String(255), nullable=False)
    source_reference = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.CheckConstraint("demand_volume IS NULL OR demand_volume >= 0", name="chk_demand_volume"),
        db.CheckConstraint("local_production IS NULL OR local_production >= 0", name="chk_local_production"),
        db.CheckConstraint("import_volume IS NULL OR import_volume >= 0", name="chk_import_volume"),
    )
