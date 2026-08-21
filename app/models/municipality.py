from app.extensions import db
from datetime import datetime


class Municipality(db.Model):
    __tablename__ = "municipalities"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    geojson_ref = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    users = db.relationship("User", backref="municipality", lazy=True)
    production_records = db.relationship("ProductionRecord", backref="municipality", lazy=True)
    forecast_snapshots = db.relationship("ForecastSnapshot", backref="municipality", lazy=True)
