from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models.municipality import Municipality
from app.models.production_record import ProductionRecord
from app.extensions import db

gis_map_bp = Blueprint("gis_map", __name__)


@gis_map_bp.route("/map")
def map_view():
    municipalities = Municipality.query.filter_by(status="active").all()
    data = []
    for m in municipalities:
        records = ProductionRecord.query.filter_by(municipality_id=m.id, status="approved").all()
        production = sum(float(r.production_volume) for r in records)
        data.append({
            "id": m.id,
            "name": m.name,
            "lat": float(m.latitude),
            "lng": float(m.longitude),
            "production": production,
            "records_count": len(records),
        })
    return render_template("shared/gis_map.html", municipalities=data, is_admin=current_user.is_authenticated and current_user.role == "admin")
