from app.extensions import db
from datetime import datetime


class ForecastRun(db.Model):
    __tablename__ = "forecast_runs"

    id = db.Column(db.Integer, primary_key=True)
    municipality_id = db.Column(db.Integer, db.ForeignKey("municipalities.id"), nullable=True)
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    algorithm = db.Column(db.String(50), nullable=False, default="linear_regression")
    readiness = db.Column(db.String(20), nullable=False, default="not_ready")
    reliability = db.Column(db.String(20), nullable=False, default="low")
    trend_direction = db.Column(db.String(20), nullable=False, default="stable")
    expected_change_pct = db.Column(db.Numeric(6, 2), nullable=True)
    projected_total = db.Column(db.Numeric(14, 2), nullable=True)
    mae = db.Column(db.Numeric(14, 2), nullable=True)
    rmse = db.Column(db.Numeric(14, 2), nullable=True)
    mape = db.Column(db.Numeric(8, 2), nullable=True)
    r2 = db.Column(db.Numeric(8, 4), nullable=True)
    candidate_metrics = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    municipality = db.relationship("Municipality", backref="forecast_runs", lazy=True)
    points = db.relationship("ForecastPoint", backref="run", lazy=True, cascade="all, delete-orphan")

    __table_args__ = (
        db.CheckConstraint("expected_change_pct IS NULL OR expected_change_pct >= -100", name="chk_expected_change_pct"),
        db.CheckConstraint("projected_total IS NULL OR projected_total >= 0", name="chk_projected_total"),
    )


class ForecastPoint(db.Model):
    __tablename__ = "forecast_points"

    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey("forecast_runs.id"), nullable=False)
    period_label = db.Column(db.String(50), nullable=False)
    predicted_value = db.Column(db.Numeric(14, 2), nullable=True)
    lower_bound = db.Column(db.Numeric(14, 2), nullable=True)
    upper_bound = db.Column(db.Numeric(14, 2), nullable=True)
    is_forecast = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.CheckConstraint("predicted_value IS NULL OR predicted_value >= 0", name="chk_predicted_value"),
        db.CheckConstraint("lower_bound IS NULL OR lower_bound >= 0", name="chk_lower_bound"),
        db.CheckConstraint("upper_bound IS NULL OR upper_bound >= 0", name="chk_upper_bound"),
    )
