from app.models.production_record import ProductionRecord


def get_readiness(municipality_id):
    total = ProductionRecord.query.filter_by(municipality_id=municipality_id).count()
    if total == 0:
        return {
            "status": "not_ready",
            "reason": "No production records submitted yet.",
            "record_count": 0,
            "approved_count": 0,
            "completeness_pct": 0.0,
        }

    approved = ProductionRecord.query.filter_by(municipality_id=municipality_id, status="approved").count()
    approved_records = ProductionRecord.query.filter_by(municipality_id=municipality_id, status="approved").all()
    completeness = _compute_completeness(approved_records)

    if approved >= 5 and completeness >= 80:
        status = "ready"
        reason = f"{approved} approved records with {round(completeness, 2)}% completeness."
    elif approved >= 3 or completeness >= 50:
        status = "limited"
        reason = f"{approved} approved records with {round(completeness, 2)}% completeness."
    else:
        status = "not_ready"
        reason = f"{approved} approved records with {round(completeness, 2)}% completeness."

    return {
        "status": status,
        "reason": reason,
        "record_count": total,
        "approved_count": approved,
        "completeness_pct": round(completeness, 2),
    }


def _compute_completeness(records):
    if not records:
        return 0.0

    fields = ["barangay", "production_area", "num_salt_beds", "producer_age", "producer_gender"]
    total_values = len(records) * len(fields)
    non_null_count = 0

    for r in records:
        for f in fields:
            val = getattr(r, f)
            if val is not None and not (isinstance(val, str) and val.strip() == ""):
                non_null_count += 1

    if total_values == 0:
        return 0.0
    return (non_null_count / total_values) * 100
