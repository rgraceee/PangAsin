from app.models.production_record import ProductionRecord
from app.models.forecast_snapshot import ForecastSnapshot
from app.extensions import db


def get_readiness(municipality_id):
    approved = ProductionRecord.query.filter_by(municipality_id=municipality_id, status="approved").count()
    total = ProductionRecord.query.filter_by(municipality_id=municipality_id).count()
    if total == 0:
        status = "not_ready"
        reason = "No production records submitted yet."
    elif approved < 5:
        status = "limited"
        reason = f"Only {approved} approved record(s) out of {total} total."
    else:
        status = "ready"
        reason = f"{approved} approved records available for forecasting."

    return {
        "status": status,
        "reason": reason,
        "record_count": total,
        "approved_count": approved,
    }
