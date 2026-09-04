from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.models.production_record import ProductionRecord
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.user import User
from app.models.demand_benchmark import DemandBenchmark
from app.extensions import db
from datetime import datetime, date, timedelta
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.services.forecast_service import _monthly_aggregates

admin_api_bp = Blueprint("admin_api", __name__, url_prefix="/api/admin")

AGE_BUCKET_FIELDS = (
    "producers_18_30",
    "producers_31_40",
    "producers_41_50",
    "producers_51_60",
    "producers_61_plus",
)

QUALITY_WEIGHTS = {
    "production_volume": 0.20,
    "num_salt_beds": 0.10,
    "area_per_salt_bed": 0.10,
    "registered_producers": 0.15,
    "male_producers": 0.10,
    "female_producers": 0.10,
    "record_date": 0.05,
    "production_method": 0.05,
    "barangay_id": 0.15,
}

QUALITY_FIELDS = list(QUALITY_WEIGHTS.keys())


def _record_submit_user(record):
    if record.submitter is not None:
        return {
            "id": record.submitter.id,
            "name": record.submitter.name,
            "email": record.submitter.email,
        }
    return None


def _record_reviewer(record):
    if record.reviewer is not None:
        return {
            "id": record.reviewer.id,
            "name": record.reviewer.name,
            "email": record.reviewer.email,
        }
    return None


def _serialize(record):
    return {
        "id": record.id,
        "municipality_id": record.municipality_id,
        "municipality_name": record.municipality.name if record.municipality else None,
        "barangay_id": record.barangay_id,
        "barangay": record.barangay.name if record.barangay else None,
        "record_date": record.record_date.isoformat() if record.record_date else None,
        "registered_producers": record.registered_producers,
        "male_producers": record.male_producers,
        "female_producers": record.female_producers,
        **{f: getattr(record, f) for f in AGE_BUCKET_FIELDS},
        "production_volume": float(record.production_volume) if record.production_volume is not None else None,
        "num_salt_beds": record.num_salt_beds,
        "area_per_salt_bed": float(record.area_per_salt_bed) if record.area_per_salt_bed is not None else None,
        "production_method": record.production_method,
        "status": record.status,
        "reviewer_comment": record.reviewer_comment,
        "submitted_by": record.submitted_by,
        "submitter": _record_submit_user(record),
        "submitted_at": record.submitted_at.isoformat() if record.submitted_at else None,
        "reviewed_by": record.reviewed_by,
        "reviewer": _record_reviewer(record),
        "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
        "output_per_bed": round(float(record.production_volume) / record.num_salt_beds, 2)
        if record.production_volume is not None and record.num_salt_beds
        else None,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


def _admin_only():
    return current_user.role != "admin"


def _parse_date(date_str):
    if not date_str:
        return None
    return datetime.strptime(date_str, "%Y-%m-%d").date()


@admin_api_bp.route("/me", methods=["GET"])
@login_required
def me():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    return jsonify({
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "municipality_id": current_user.municipality_id,
        "municipality_name": current_user.municipality.name if current_user.municipality else None,
    })


@admin_api_bp.route("/municipalities", methods=["GET"])
@login_required
def list_municipalities():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    munis = Municipality.query.order_by(Municipality.name).all()
    encoder_counts = dict(
        db.session.query(User.municipality_id, func.count(User.id))
        .filter(User.role == "encoder")
        .group_by(User.municipality_id)
        .all()
    )
    record_counts = dict(
        db.session.query(ProductionRecord.municipality_id, func.count(ProductionRecord.id))
        .group_by(ProductionRecord.municipality_id)
        .all()
    )
    return jsonify({
        "municipalities": [
            {
                "id": m.id,
                "name": m.name,
                "status": m.status,
                "latitude": float(m.latitude) if m.latitude is not None else None,
                "longitude": float(m.longitude) if m.longitude is not None else None,
                "encoder_count": encoder_counts.get(m.id, 0),
                "record_count": record_counts.get(m.id, 0),
            }
            for m in munis
        ]
    })


@admin_api_bp.route("/users", methods=["GET"])
@login_required
def list_users():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    query = User.query
    role = request.args.get("role")
    status = request.args.get("status")
    muni = request.args.get("municipality_id", type=int)
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)
    if muni:
        query = query.filter(User.municipality_id == muni)
    users = query.order_by(User.role, User.name).all()
    return jsonify({
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "municipality_id": u.municipality_id,
                "municipality_name": u.municipality.name if u.municipality else None,
                "status": u.status,
                "last_login": u.last_login.isoformat() if u.last_login else None,
            }
            for u in users
        ]
    })


@admin_api_bp.route("/users", methods=["POST"])
@login_required
def create_user():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    data = request.get_json(silent=True) or {}

    errors = []
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    role = (data.get("role") or "encoder").strip()
    muni_id = data.get("municipality_id")
    status = (data.get("status") or "active").strip()
    password = data.get("password") or ""

    if not name:
        errors.append("name is required.")
    if not email:
        errors.append("email is required.")
    if role != "encoder":
        errors.append("Only encoder accounts can be created via this endpoint.")
    if not muni_id:
        errors.append("municipality_id is required for encoder accounts.")
    elif not Municipality.query.get(muni_id):
        errors.append("municipality_id is invalid.")
    if status not in ("active", "inactive"):
        errors.append("status must be active or inactive.")
    if not password or len(password) < 6:
        errors.append("password is required (min 6 chars).")
    if email and User.query.filter_by(email=email).first():
        errors.append("email is already in use.")

    if errors:
        return jsonify({"errors": errors}), 400

    user = User(
        name=name,
        email=email,
        role="encoder",
        municipality_id=muni_id,
        status=status,
    )
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Could not create user (email may already exist)."}), 409
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not create user. Please try again."}), 500
    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "municipality_id": user.municipality_id,
        "municipality_name": user.municipality.name if user.municipality else None,
        "status": user.status,
    }), 201


@admin_api_bp.route("/users/<int:user_id>", methods=["PATCH"])
@login_required
def update_user(user_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json(silent=True) or {}
    errors = []

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            errors.append("name cannot be empty.")
        else:
            user.name = name

    if "municipality_id" in data:
        muni_id = data.get("municipality_id")
        if user.role == "encoder":
            if not muni_id:
                errors.append("municipality_id is required for encoder accounts.")
            elif not Municipality.query.get(muni_id):
                errors.append("municipality_id is invalid.")
            else:
                user.municipality_id = muni_id
        else:
            user.municipality_id = muni_id

    if "status" in data:
        status = data.get("status")
        if status not in ("active", "inactive"):
            errors.append("status must be active or inactive.")
        else:
            user.status = status

    if "password" in data and data["password"]:
        if len(data["password"]) < 6:
            errors.append("password must be at least 6 chars.")
        else:
            user.set_password(data["password"])

    if errors:
        return jsonify({"errors": errors}), 400

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not update user. Please try again."}), 500

    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "municipality_id": user.municipality_id,
        "municipality_name": user.municipality.name if user.municipality else None,
        "status": user.status,
    })


@admin_api_bp.route("/records", methods=["GET"])
@login_required
def list_records():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    query = ProductionRecord.query
    status = request.args.get("status")
    muni = request.args.get("municipality_id", type=int)
    barangay_id = request.args.get("barangay_id", type=int)
    q = request.args.get("q")
    start = request.args.get("start")
    end = request.args.get("end")
    page = request.args.get("page", type=int)
    limit = request.args.get("limit", type=int)

    if status:
        query = query.filter(ProductionRecord.status == status)
    if muni:
        query = query.filter(ProductionRecord.municipality_id == muni)
    if barangay_id:
        query = query.filter(ProductionRecord.barangay_id == barangay_id)
    if q:
        like = f"%{q}%"
        query = query.join(Barangay, Barangay.id == ProductionRecord.barangay_id).filter(
            Barangay.name.ilike(like)
        )
    if start:
        try:
            query = query.filter(ProductionRecord.record_date >= _parse_date(start))
        except ValueError:
            return jsonify({"error": "start must be YYYY-MM-DD."}), 400
    if end:
        try:
            query = query.filter(ProductionRecord.record_date <= _parse_date(end))
        except ValueError:
            return jsonify({"error": "end must be YYYY-MM-DD."}), 400

    total = query.count()
    if page and limit and page > 0 and limit > 0:
        records = (
            query.order_by(ProductionRecord.record_date.desc(), ProductionRecord.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
    else:
        records = query.order_by(ProductionRecord.record_date.desc(), ProductionRecord.id.desc()).all()

    return jsonify({
        "records": [_serialize(r) for r in records],
        "total": total,
        "page": page,
        "limit": limit,
    })


@admin_api_bp.route("/records/<int:record_id>", methods=["GET"])
@login_required
def get_record(record_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    record = ProductionRecord.query.get(record_id)
    if not record:
        return jsonify({"error": "Record not found."}), 404
    return jsonify(_serialize(record))


@admin_api_bp.route("/records/<int:record_id>/review", methods=["PATCH", "POST"])
@login_required
def review_record(record_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    record = ProductionRecord.query.get(record_id)
    if not record:
        return jsonify({"error": "Record not found."}), 404
    if record.status != "pending":
        return jsonify({"error": f"Only pending records can be reviewed. Current status: {record.status}."}), 409

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if new_status not in ("approved", "rejected"):
        return jsonify({"error": "status must be 'approved' or 'rejected'."}), 400

    record.status = new_status
    record.reviewer_comment = data.get("reviewer_comment") or None
    record.reviewed_by = current_user.id
    record.reviewed_at = datetime.utcnow()

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not save review. Please try again."}), 500
    return jsonify(_serialize(record))


@admin_api_bp.route("/stats", methods=["GET"])
@login_required
def stats():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    by_municipality = (
        db.session.query(
            ProductionRecord.municipality_id,
            Municipality.name,
            func.sum(ProductionRecord.production_volume).label("total_volume"),
            func.count(ProductionRecord.id).label("record_count"),
            func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed).label("total_area"),
            func.sum(ProductionRecord.num_salt_beds).label("total_beds"),
            func.sum(ProductionRecord.registered_producers).label("total_registered"),
            func.sum(ProductionRecord.male_producers).label("total_male"),
            func.sum(ProductionRecord.female_producers).label("total_female"),
        )
        .join(Municipality, Municipality.id == ProductionRecord.municipality_id)
        .group_by(ProductionRecord.municipality_id, Municipality.name)
        .all()
    )

    by_barangay = (
        db.session.query(
            ProductionRecord.municipality_id,
            ProductionRecord.barangay_id,
            Barangay.name,
            func.sum(ProductionRecord.production_volume).label("total_volume"),
            func.count(ProductionRecord.id).label("record_count"),
            func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed).label("total_area"),
            func.sum(ProductionRecord.registered_producers).label("total_registered"),
        )
        .join(Barangay, Barangay.id == ProductionRecord.barangay_id)
        .group_by(ProductionRecord.municipality_id, ProductionRecord.barangay_id, Barangay.name)
        .all()
    )
    by_barangay_by_muni = {}
    for row in by_barangay:
        by_barangay_by_muni.setdefault(row.municipality_id, []).append({
            "barangay_id": row.barangay_id,
            "barangay": row.name,
            "total_volume_kg": float(row.total_volume or 0),
            "record_count": row.record_count,
            "total_area_sqm": float(row.total_area or 0),
            "total_registered_producers": int(row.total_registered or 0),
        })

    total_volume = db.session.query(func.sum(ProductionRecord.production_volume)).scalar() or 0
    total_area = db.session.query(func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed)).scalar() or 0
    total_records = db.session.query(func.count(ProductionRecord.id)).scalar() or 0
    total_beds = db.session.query(func.sum(ProductionRecord.num_salt_beds)).scalar() or 0
    total_registered = db.session.query(func.sum(ProductionRecord.registered_producers)).scalar() or 0
    pending_validation_count = ProductionRecord.query.filter_by(status="pending").count()

    return jsonify({
        "total_volume_kg": float(total_volume),
        "total_area_sqm": float(total_area or 0),
        "record_count": total_records,
        "total_salt_beds": int(total_beds or 0),
        "total_registered_producers": int(total_registered or 0),
        "pending_validation_count": pending_validation_count,
        "by_municipality": [
            {
                "municipality_id": r.municipality_id,
                "municipality_name": r.name,
                "total_volume_kg": float(r.total_volume or 0),
                "record_count": r.record_count,
                "total_area_sqm": float(r.total_area or 0),
                "total_salt_beds": int(r.total_beds or 0),
                "total_registered_producers": int(r.total_registered or 0),
                "total_male_producers": int(r.total_male or 0),
                "total_female_producers": int(r.total_female or 0),
                "by_barangay": by_barangay_by_muni.get(r.municipality_id, []),
            }
            for r in by_municipality
        ],
    })


@admin_api_bp.route("/data-quality", methods=["GET"])
@login_required
def data_quality():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    records = ProductionRecord.query.all()
    total_records = len(records)
    by_muni = {}

    for r in records:
        muni_id = r.municipality_id
        muni_name = r.municipality.name if r.municipality else "Unknown"
        bucket = by_muni.setdefault(muni_id, {
            "municipality_id": muni_id,
            "municipality_name": muni_name,
            "records": [],
            "field_present": {f: 0 for f in QUALITY_FIELDS},
        })
        bucket["records"].append(r)
        for field in QUALITY_FIELDS:
            value = getattr(r, field, None)
            if field == "area_per_salt_bed":
                if value is not None:
                    bucket["field_present"][field] += 1
            else:
                if value is not None and value != "":
                    bucket["field_present"][field] += 1

    municipality_scores = []
    overall_field_present = {f: 0 for f in QUALITY_FIELDS}

    for bucket in by_muni.values():
        count = len(bucket["records"])
        completeness = {}
        score_total = 0.0
        for field in QUALITY_FIELDS:
            present = bucket["field_present"][field]
            rate = (present / count) if count else 0.0
            completeness[field] = round(rate * 100, 1)
            score_total += rate * QUALITY_WEIGHTS[field]
            overall_field_present[field] += present
        municipality_scores.append({
            "municipality_id": bucket["municipality_id"],
            "municipality_name": bucket["municipality_name"],
            "record_count": count,
            "completeness": completeness,
            "quality_score": round(score_total * 100, 1),
        })

    overall_completeness = {}
    overall_score = 0.0
    if total_records:
        for field in QUALITY_FIELDS:
            rate = overall_field_present[field] / total_records
            overall_completeness[field] = round(rate * 100, 1)
            overall_score += rate * QUALITY_WEIGHTS[field]
    overall_score = round(overall_score * 100, 1)

    municipality_scores.sort(key=lambda x: x["quality_score"])

    return jsonify({
        "overall_quality_score": overall_score,
        "overall_completeness": overall_completeness,
        "weights": QUALITY_WEIGHTS,
        "municipalities": municipality_scores,
        "total_records": total_records,
    })


@admin_api_bp.route("/insight", methods=["GET"])
@login_required
def insight():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    total_volume = db.session.query(func.sum(ProductionRecord.production_volume)).scalar() or 0
    pending = ProductionRecord.query.filter_by(status="pending").count()
    approved = ProductionRecord.query.filter_by(status="approved").count()
    rejected = ProductionRecord.query.filter_by(status="rejected").count()
    top_muni = (
        db.session.query(Municipality.name, func.sum(ProductionRecord.production_volume).label("v"))
        .join(ProductionRecord, ProductionRecord.municipality_id == Municipality.id)
        .group_by(Municipality.name)
        .order_by(func.sum(ProductionRecord.production_volume).desc())
        .first()
    )

    if top_muni:
        text = (
            f"Top producing municipality is {top_muni.name} "
            f"({float(top_muni.v):,.0f} kg). "
            f"{pending} record(s) awaiting validation, {approved} approved, {rejected} rejected."
        )
    else:
        text = "No production data yet. Submit encoder records to populate the dashboard."

    return jsonify({
        "insight": text,
        "methodology": "Heuristic summary of DB aggregates. Will be replaced by Module 4.2 forecasting engine.",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "source": "module4.2-pending",
    })


# National-level sector demand breakdown (reference data, MT). Not stored in the
# demand_benchmarks table (which holds annual supply/demand figures); served here
# as a labeled reference constant for the sector breakdown visualisation.
SECTOR_DEMAND = {
    "household": 320000.0,
    "foodProcessing": 180000.0,
    "industry": 120000.0,
    "agriculture": 63608.0,
}

SECTOR_DEMAND_NOTE = (
    "Reference national sector breakdown by end use. Not derived from "
    "production_records; shown for context only."
)


@admin_api_bp.route("/supply-demand", methods=["GET"])
@login_required
def supply_demand():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    provincial = DemandBenchmark.query.filter_by(geographic_scope="provincial").order_by(DemandBenchmark.year.desc()).first()
    national = DemandBenchmark.query.filter_by(geographic_scope="national").order_by(DemandBenchmark.year.desc()).first()

    pangasinan_local_kg = (
        db.session.query(func.sum(ProductionRecord.production_volume))
        .filter(ProductionRecord.status == "approved")
        .scalar()
        or 0
    )
    local_production_mt = round(pangasinan_local_kg / 1000, 2)

    pangasinan = {
        "year": provincial.year if provincial else datetime.utcnow().year,
        "demand_volume": float(provincial.demand_volume) if provincial else None,
        "local_production": local_production_mt if local_production_mt > 0 else (float(provincial.local_production) if provincial and provincial.local_production else None),
        "import_volume": float(provincial.import_volume) if provincial and provincial.import_volume is not None else None,
        "source_name": provincial.source_name if provincial else None,
    }

    philippines = {
        "year": national.year if national else None,
        "demand_volume": float(national.demand_volume) if national else None,
        "local_production": float(national.local_production) if national and national.local_production is not None else None,
        "import_volume": float(national.import_volume) if national and national.import_volume is not None else None,
        "source_name": national.source_name if national else None,
    }

    return jsonify({
        "pangasinan": pangasinan,
        "philippines": philippines,
        "sector_demand": SECTOR_DEMAND,
        "sector_demand_note": SECTOR_DEMAND_NOTE,
    })


@admin_api_bp.route("/trends", methods=["GET"])
@login_required
def trends():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    latest = (
        db.session.query(func.max(ProductionRecord.record_date))
        .filter(ProductionRecord.status == "approved")
        .scalar()
    )
    if latest is None:
        return jsonify({"trend": [], "municipalities": [], "period": None})

    end = latest
    start = end - timedelta(days=365)

    labels, values, _ = _monthly_aggregates(None, start, end)
    trend = [
        {"month": labels[i], "total": round(values[i] / 1000, 2)}
        for i in range(len(labels))
    ]

    by_muni = (
        db.session.query(
            Municipality.id,
            Municipality.name,
            func.sum(ProductionRecord.production_volume).label("v"),
        )
        .join(ProductionRecord, ProductionRecord.municipality_id == Municipality.id)
        .filter(ProductionRecord.status == "approved")
        .filter(ProductionRecord.record_date >= start)
        .filter(ProductionRecord.record_date <= end)
        .group_by(Municipality.id, Municipality.name)
        .all()
    )
    by_muni_prev = (
        db.session.query(
            Municipality.id,
            func.sum(ProductionRecord.production_volume).label("v"),
        )
        .join(ProductionRecord, ProductionRecord.municipality_id == Municipality.id)
        .filter(ProductionRecord.status == "approved")
        .filter(ProductionRecord.record_date >= start - timedelta(days=365))
        .filter(ProductionRecord.record_date < start)
        .group_by(Municipality.id)
        .all()
    )
    prev_map = {r.id: float(r.v or 0) for r in by_muni_prev}

    municipalities = []
    for r in by_muni:
        current_mt = round(float(r.v or 0) / 1000, 2)
        previous_mt = round(prev_map.get(r.id, 0) / 1000, 2)
        change_pct = None
        if previous_mt:
            change_pct = round(((current_mt - previous_mt) / previous_mt) * 100, 1)
        municipalities.append({
            "name": r.name,
            "current": current_mt,
            "previous": previous_mt,
            "changePct": change_pct,
        })

    municipalities.sort(key=lambda x: x["current"], reverse=True)

    return jsonify({
        "trend": trend,
        "municipalities": municipalities,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
    })