from app.models.production_record import ProductionRecord
from app.extensions import db


def compute_municipality(municipality_id):
    records = ProductionRecord.query.filter_by(municipality_id=municipality_id).all()
    total = len(records)
    if total == 0:
        return {
            "municipality_id": municipality_id,
            "completeness_pct": 0.0,
            "last_submission": None,
            "missing_fields": {},
            "duplicates": 0,
            "invalid": 0,
        }

    required_fields = ["period_type", "record_date", "barangay", "production_volume", "production_method", "production_area", "num_salt_beds"]
    missing_counts = {f: 0 for f in required_fields}
    invalid = 0
    seen = set()
    duplicates = 0

    for r in records:
        for f in required_fields:
            val = getattr(r, f)
            if val is None or (isinstance(val, str) and val.strip() == ""):
                missing_counts[f] += 1
        key = (r.municipality_id, r.period_type, str(r.record_date), r.barangay, str(r.production_volume))
        if key in seen:
            duplicates += 1
        else:
            seen.add(key)
        if r.production_volume < 0 or r.production_area < 0 or r.num_salt_beds < 0:
            invalid += 1

    completeness = 1.0 - (sum(missing_counts.values()) / (total * len(required_fields)))
    last = max((r.created_at for r in records), default=None)

    return {
        "municipality_id": municipality_id,
        "completeness_pct": round(completeness * 100, 2),
        "last_submission": last,
        "missing_fields": missing_counts,
        "duplicates": duplicates,
        "invalid": invalid,
    }


def compute_all():
    from app.models.municipality import Municipality
    results = []
    for m in Municipality.query.all():
        results.append(compute_municipality(m.id))
    return results
