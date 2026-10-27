from datetime import datetime

from app.extensions import db


class MunicipalityMonthlyProduction(db.Model):
    __tablename__ = "municipality_monthly_production"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(
        db.Integer,
        db.ForeignKey("municipalities.id", ondelete="RESTRICT"),
        nullable=False,
    )
    production_year = db.Column(db.Integer, nullable=False)
    production_month = db.Column(db.Integer, nullable=False)
    production_kg = db.Column(db.Numeric(16, 6), nullable=False)
    source_label = db.Column(db.String(255), nullable=False)
    basis = db.Column(db.Text, nullable=False)
    is_synthetic = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint(
            "municipality_id",
            "production_year",
            "production_month",
            name="uq_municipality_monthly_production_period",
        ),
        db.CheckConstraint(
            "production_month BETWEEN 1 AND 12",
            name="chk_production_month",
        ),
        db.CheckConstraint("production_kg >= 0", name="chk_production_kg"),
        db.Index(
            "ix_municipality_monthly_production_period",
            "production_year",
            "production_month",
        ),
    )


class MunicipalitySaltBedData(db.Model):
    __tablename__ = "municipality_salt_bed_data"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(
        db.Integer,
        db.ForeignKey("municipalities.id", ondelete="RESTRICT"),
        nullable=False,
    )
    data_year = db.Column(db.Integer, nullable=False)
    annual_production_kg = db.Column(db.Numeric(16, 6), nullable=False)
    production_source = db.Column(db.String(100), nullable=False)
    bed_count = db.Column(db.Numeric(14, 6), nullable=False)
    sensitivity_low_beds = db.Column(db.Numeric(14, 6), nullable=False)
    sensitivity_high_beds = db.Column(db.Numeric(14, 6), nullable=False)
    implied_beds_using_2024_output = db.Column(db.Numeric(14, 6), nullable=True)
    legacy_beds_estimate = db.Column(db.Numeric(14, 6), nullable=True)
    area_based_literal_count = db.Column(db.Numeric(14, 6), nullable=True)
    confidence_and_notes = db.Column(db.Text, nullable=False)
    source_label = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint(
            "municipality_id",
            "data_year",
            name="uq_municipality_salt_bed_data_year",
        ),
        db.CheckConstraint("annual_production_kg >= 0", name="chk_bed_production_kg"),
        db.CheckConstraint("bed_count >= 0", name="chk_bed_count"),
        db.CheckConstraint(
            "sensitivity_low_beds >= 0",
            name="chk_sensitivity_low_beds",
        ),
        db.CheckConstraint(
            "sensitivity_high_beds >= sensitivity_low_beds",
            name="chk_sensitivity_bed_range",
        ),
    )
