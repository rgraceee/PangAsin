from app.extensions import db
from datetime import datetime


class Municipality(db.Model):
    __tablename__ = "municipalities"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    latitude = db.Column(db.Numeric(9, 6), nullable=False)
    longitude = db.Column(db.Numeric(9, 6), nullable=False)
    geojson_ref = db.Column(db.String(255), nullable=True)
    status = db.Column(db.Enum("active", "inactive", name="municipality_status"), default="active", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    users = db.relationship("User", backref="municipality", lazy=True)
    production_records = db.relationship("ProductionRecord", backref="municipality", lazy=True)
    submission_batches = db.relationship("SubmissionBatch", backref="municipality", lazy=True)
    forecast_runs = db.relationship("ForecastRun", backref="municipality", lazy=True)
    forecast_results = db.relationship("ForecastResult", backref="municipality", lazy=True)
    reports = db.relationship("Report", backref="municipality", lazy=True)
