from app.extensions import db
from datetime import datetime


class ForecastResult(db.Model):
    __tablename__ = "forecast_results"

    id = db.Column(db.Integer, primary_key=True)
    forecast_run_id = db.Column(db.Integer, db.ForeignKey("forecast_runs.id"), nullable=False)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=False)
    forecast_period = db.Column(db.Date, nullable=False)
    forecast_production = db.Column(db.Numeric(12, 2), nullable=False)
    lower_bound = db.Column(db.Numeric(12, 2), nullable=True)
    upper_bound = db.Column(db.Numeric(12, 2), nullable=True)
    trend_direction = db.Column(db.Enum("increasing", "stable", "declining", name="trend_direction"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
