from datetime import datetime

from app.extensions import db


SECTOR_DEMAND_SCOPES = ("national", "provincial")


class SectorDemandSetting(db.Model):
    __tablename__ = "sector_demand_settings"

    id = db.Column(db.Integer, primary_key=True)
    geographic_scope = db.Column(db.String(20), nullable=False)
    sector_name = db.Column(db.String(100), nullable=False)
    percentage = db.Column(db.Numeric(5, 2), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "geographic_scope",
            "sector_name",
            name="uq_sector_demand_scope_name",
        ),
        db.CheckConstraint(
            "geographic_scope IN ('national', 'provincial')",
            name="chk_sector_demand_scope",
        ),
        db.CheckConstraint(
            "percentage >= 0 AND percentage <= 100",
            name="chk_sector_demand_percentage",
        ),
    )
