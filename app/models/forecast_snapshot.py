from app.extensions import db
from datetime import datetime


class ForecastSnapshot(db.Model):
    __tablename__ = "forecast_snapshots"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    model_version = db.Column(db.String(50), nullable=False)
    forecast_production = db.Column(db.Numeric(12, 2), nullable=False)
    growth_rate = db.Column(db.Numeric(6, 3), nullable=False)
    trend_direction = db.Column(db.Enum("increasing", "stable", "declining", name="trend_direction"), nullable=False)
    production_capacity_forecast = db.Column(db.Numeric(12, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
