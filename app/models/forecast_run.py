from app.extensions import db
from datetime import datetime


class ForecastRun(db.Model):
    __tablename__ = "forecast_runs"

    id = db.Column(db.Integer, primary_key=True)
    model_name = db.Column(db.String(100), nullable=False)
    model_version = db.Column(db.String(50), nullable=False)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=True)
    training_start_date = db.Column(db.Date, nullable=True)
    training_end_date = db.Column(db.Date, nullable=True)
    parameters = db.Column(db.JSON, nullable=True)
    mae = db.Column(db.Numeric(14, 4), nullable=True)
    rmse = db.Column(db.Numeric(14, 4), nullable=True)
    mape = db.Column(db.Numeric(14, 4), nullable=True)
    r_squared = db.Column(db.Numeric(14, 4), nullable=True)
    generated_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    forecast_results = db.relationship("ForecastResult", backref="forecast_run", lazy=True, cascade="all, delete-orphan")
