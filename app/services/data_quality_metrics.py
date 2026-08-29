from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality
from app.services.forecast_readiness import get_readiness


def compute_municipality(municipality_id):
    records = ProductionRecord.query.filter_by(municipality_id=municipality_id).all()
    total = len(records)
    if total == 0:
        return {
            "municipality_id": municipality_id,
            "municipality_name": _get_municipality_name(municipality_id),
            "completeness_pct": 0.0,
            "total_records": 0,
            "approved_count": 0,
            "pending_count": 0,
            "rejected_count": 0,
            "draft_count": 0,
            "missing_fields": {},
            "duplicates": 0,
            "invalid_count": 0,
            "forecast_readiness": get_readiness(municipality_id),
        }

    required_fields = ["barangay", "production_area", "num_salt_beds", "producer_age", "producer_gender"]
    missing_counts = {f: 0 for f in required_fields}
    invalid_count = 0
    seen = set()
    duplicates = 0
    counts = {"approved": 0, "pending": 0, "rejected": 0, "draft": 0}

    for r in records:
        counts[getattr(r, "status", "draft")] = counts.get(getattr(r, "status", "draft"), 0) + 1
        for f in required_fields:
            val = getattr(r, f)
            if val is None or (isinstance(val, str) and val.strip() == ""):
                missing_counts[f] += 1
        key = (r.municipality_id, r.period_type, str(r.record_date), r.production_volume, r.production_method)
        if key in seen:
            duplicates += 1
        else:
            seen.add(key)
        if r.production_volume < 0 or (r.production_area is not None and r.production_area <= 0) or (r.num_salt_beds is not None and r.num_salt_beds <= 0) or (r.producer_age is not None and (r.producer_age < 15 or r.producer_age > 100)):
            invalid_count += 1

    completeness = 1.0 - (sum(missing_counts.values()) / (total * len(required_fields)))

    return {
        "municipality_id": municipality_id,
        "municipality_name": _get_municipality_name(municipality_id),
        "completeness_pct": round(completeness * 100, 2),
        "total_records": total,
        "approved_count": counts.get("approved", 0),
        "pending_count": counts.get("pending", 0),
        "rejected_count": counts.get("rejected", 0),
        "draft_count": counts.get("draft", 0),
        "missing_fields": missing_counts,
        "duplicates": duplicates,
        "invalid_count": invalid_count,
        "forecast_readiness": get_readiness(municipality_id),
    }


def compute_all():
    results = []
    for m in Municipality.query.all():
        results.append(compute_municipality(m.id))
    return results


def _get_municipality_name(municipality_id):
    m = Municipality.query.get(municipality_id)
    return m.name if m else "Unknown"
