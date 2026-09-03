from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.models.production_record import ProductionRecord, PRODUCTION_METHODS
from app.models.barangay import Barangay
from app.extensions import db
from datetime import datetime, date
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

encoder_api_bp = Blueprint("encoder_api", __name__, url_prefix="/api/encoder")

PRODUCER_COUNT_FIELDS = ("male_producers", "female_producers")

ENCODER_READ_ONLY_STATUS = "approved"


def _barangay_name(record):
    if record.barangay is not None:
        return record.barangay.name
    return None


def _serialize(record):
    return {
        "id": record.id,
        "municipality_id": record.municipality_id,
        "barangay_id": record.barangay_id,
        "barangay": _barangay_name(record),
        "record_date": record.record_date.isoformat() if record.record_date else None,
        "registered_producers": record.registered_producers,
        "male_producers": record.male_producers,
        "female_producers": record.female_producers,
        "production_volume": float(record.production_volume) if record.production_volume is not None else None,
        "num_salt_beds": record.num_salt_beds,
        "area_per_salt_bed": float(record.area_per_salt_bed) if record.area_per_salt_bed is not None else None,
        "production_method": record.production_method,
        "status": record.status,
        "reviewer_comment": record.reviewer_comment,
        "reviewed_by": record.reviewed_by,
        "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
        "submitted_by": record.submitted_by,
        "output_per_bed": round(float(record.production_volume) / record.num_salt_beds, 2)
        if record.production_volume is not None and record.num_salt_beds
        else None,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


def _parse_date(date_str):
    if not date_str:
        return None
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def _allocate(record, data):
    if "barangay_id" in data:
        record.barangay_id = data["barangay_id"]
    date_str = data.get("record_date")
    if date_str:
        record.record_date = _parse_date(date_str)
    for field in ("production_volume", "num_salt_beds") + PRODUCER_COUNT_FIELDS:
        if field in data:
            setattr(record, field, data[field])
    if "area_per_salt_bed" in data:
        record.area_per_salt_bed = data["area_per_salt_bed"] if data["area_per_salt_bed"] not in (None, "") else None
    if "production_method" in data:
        record.production_method = data["production_method"]


def _validate(data, partial=False):
    errors = []

    if not partial or "barangay_id" in data:
        barangay_id = data.get("barangay_id")
        if barangay_id in (None, ""):
            errors.append("barangay_id is required.")
        else:
            barangay = Barangay.query.get(barangay_id)
            if not barangay or barangay.municipality_id != current_user.municipality_id:
                errors.append("barangay_id is invalid for this municipality.")

    if not partial or "record_date" in data:
        date_str = data.get("record_date")
        if not date_str:
            errors.append("record_date is required.")
        else:
            try:
                _parse_date(date_str)
            except (TypeError, ValueError):
                errors.append("record_date must be a date in YYYY-MM-DD format.")

    if not partial or "production_volume" in data:
        try:
            vol = float(data.get("production_volume"))
            if vol < 0:
                errors.append("production_volume must be non-negative.")
        except (TypeError, ValueError):
            errors.append("production_volume must be a number (kg).")

    if not partial or "num_salt_beds" in data:
        value = data.get("num_salt_beds")
        if value in (None, ""):
            errors.append("num_salt_beds is required.")
        else:
            try:
                if int(value) <= 0:
                    errors.append("num_salt_beds must be positive.")
            except (TypeError, ValueError):
                errors.append("num_salt_beds must be an integer.")

    for field in PRODUCER_COUNT_FIELDS:
        if not partial or field in data:
            value = data.get(field)
            if value in (None, ""):
                errors.append(f"{field} is required.")
            else:
                try:
                    if int(value) < 0:
                        errors.append(f"{field} must be non-negative.")
                except (TypeError, ValueError):
                    errors.append(f"{field} must be an integer.")

    if "area_per_salt_bed" in data and data["area_per_salt_bed"] not in (None, ""):
        try:
            area = float(data["area_per_salt_bed"])
            if area < 0:
                errors.append("area_per_salt_bed must be non-negative (m2).")
        except (TypeError, ValueError):
            errors.append("area_per_salt_bed must be a number (m2).")

    if not partial or "production_method" in data:
        method = data.get("production_method")
        if method in (None, ""):
            errors.append("production_method is required.")
        elif method not in PRODUCTION_METHODS:
            errors.append(
                f"production_method must be one of: {', '.join(PRODUCTION_METHODS)}."
            )

    return errors


@encoder_api_bp.route("/me", methods=["GET"])
@login_required
def me():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    return jsonify({
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "municipality_id": current_user.municipality_id,
        "municipality_name": current_user.municipality.name if current_user.municipality else None,
    })


@encoder_api_bp.route("/barangays", methods=["GET"])
@login_required
def barangays():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    if not current_user.municipality_id:
        return jsonify({"error": "No municipality assigned."}), 400
    query = (
        Barangay.query.filter_by(municipality_id=current_user.municipality_id)
        .order_by(Barangay.name)
        .all()
    )
    return jsonify({
        "municipality": current_user.municipality.name if current_user.municipality else None,
        "barangays": [{"id": b.id, "name": b.name} for b in query],
    })


@encoder_api_bp.route("/records", methods=["GET"])
@login_required
def list_records():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403

    query = ProductionRecord.query.filter_by(municipality_id=current_user.municipality_id)
    barangay_id = request.args.get("barangay_id", type=int)
    status = request.args.get("status")
    if barangay_id:
        query = query.filter_by(barangay_id=barangay_id)
    if status:
        query = query.filter_by(status=status)

    records = query.order_by(ProductionRecord.record_date.desc(), ProductionRecord.id.desc()).all()
    return jsonify({"records": [_serialize(r) for r in records]})


@encoder_api_bp.route("/records", methods=["POST"])
@login_required
def create_record():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403

    data = request.get_json(silent=True) or {}
    errors = _validate(data)
    if errors:
        return jsonify({"errors": errors}), 400

    record_date = _parse_date(data["record_date"])
    dup = ProductionRecord.query.filter_by(
        municipality_id=current_user.municipality_id,
        barangay_id=data["barangay_id"],
        record_date=record_date,
    ).first()
    if dup:
        return jsonify({"error": "A record for this barangay and date already exists."}), 409

    record = ProductionRecord(
        municipality_id=current_user.municipality_id,
        submitted_by=current_user.id,
        barangay_id=data["barangay_id"],
        record_date=record_date,
        status="draft",
    )
    _allocate(record, data)
    record.registered_producers = (record.male_producers or 0) + (record.female_producers or 0)
    db.session.add(record)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "A record for this barangay and date already exists."}), 409
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not create the record. Please try again."}), 500
    return jsonify(_serialize(record)), 201


@encoder_api_bp.route("/records/<int:record_id>", methods=["GET"])
@login_required
def get_record(record_id):
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    record = ProductionRecord.query.get(record_id)
    if not record or record.municipality_id != current_user.municipality_id:
        return jsonify({"error": "Record not found."}), 404
    return jsonify(_serialize(record))


@encoder_api_bp.route("/records/<int:record_id>", methods=["PUT"])
@login_required
def update_record(record_id):
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    record = ProductionRecord.query.get(record_id)
    if not record or record.municipality_id != current_user.municipality_id:
        return jsonify({"error": "Record not found."}), 404

    if record.status == ENCODER_READ_ONLY_STATUS:
        return jsonify({
            "error": "Cannot modify an approved record. It is locked from editing."
        }), 409

    data = request.get_json(silent=True) or {}
    errors = _validate(data, partial=True)
    if errors:
        return jsonify({"errors": errors}), 400

    new_barangay_id = data.get("barangay_id", record.barangay_id)
    new_date = data.get("record_date")
    dup = None
    if new_date:
        dup = ProductionRecord.query.filter(
            ProductionRecord.municipality_id == current_user.municipality_id,
            ProductionRecord.barangay_id == new_barangay_id,
            ProductionRecord.record_date == _parse_date(new_date),
            ProductionRecord.id != record.id,
        ).first()
    if dup:
        return jsonify({"error": "A record for this barangay and date already exists."}), 409

    _allocate(record, data)
    record.registered_producers = (record.male_producers or 0) + (record.female_producers or 0)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "A record for this barangay and date already exists."}), 409
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not update the record. Please try again."}), 500
    return jsonify(_serialize(record))


@encoder_api_bp.route("/records/<int:record_id>/submit", methods=["PATCH", "POST"])
@login_required
def submit_record(record_id):
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    record = ProductionRecord.query.get(record_id)
    if not record or record.municipality_id != current_user.municipality_id:
        return jsonify({"error": "Record not found."}), 404
    if record.status != "draft":
        return jsonify({"error": f"Only draft records can be submitted. Current status: {record.status}."}), 409
    record.status = "pending"
    record.submitted_at = datetime.utcnow()
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not submit the record. Please try again."}), 500
    return jsonify(_serialize(record))


@encoder_api_bp.route("/records/<int:record_id>", methods=["DELETE"])
@login_required
def delete_record(record_id):
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    record = ProductionRecord.query.get(record_id)
    if not record or record.municipality_id != current_user.municipality_id:
        return jsonify({"error": "Record not found."}), 404

    if record.status == ENCODER_READ_ONLY_STATUS:
        return jsonify({
            "error": "Cannot delete an approved record. It is locked from deletion."
        }), 409

    db.session.delete(record)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Cannot delete this record; it is referenced by other data."}), 409
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not delete the record. Please try again."}), 500
    return jsonify({"message": "Record deleted."})


def _apply_period(query, start_raw, end_raw):
    start_d = _parse_date(start_raw) if start_raw else None
    end_d = _parse_date(end_raw) if end_raw else None
    if start_d:
        query = query.filter(ProductionRecord.record_date >= start_d)
    if end_d:
        query = query.filter(ProductionRecord.record_date <= end_d)
    return query, start_d, end_d


def _by_barangay_query():
    return (
        db.session.query(
            ProductionRecord.barangay_id,
            Barangay.name,
            func.coalesce(func.sum(ProductionRecord.production_volume), 0).label("total_volume"),
            func.count(ProductionRecord.id).label("record_count"),
            func.coalesce(
                func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed),
                0,
            ).label("total_area"),
            func.coalesce(func.sum(ProductionRecord.registered_producers), 0).label("total_registered"),
        )
        .join(Barangay, Barangay.id == ProductionRecord.barangay_id)
        .filter(ProductionRecord.municipality_id == current_user.municipality_id)
    )


@encoder_api_bp.route("/stats", methods=["GET"])
@login_required
def stats():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403

    base = ProductionRecord.query.filter_by(municipality_id=current_user.municipality_id)
    base, start_d, end_d = _apply_period(base, request.args.get("start"), request.args.get("end"))

    by_barangay_q = _by_barangay_query()
    by_barangay_q, _, _ = _apply_period(by_barangay_q, request.args.get("start"), request.args.get("end"))
    by_barangay = by_barangay_q.group_by(ProductionRecord.barangay_id, Barangay.name).all()

    total_volume = base.with_entities(func.coalesce(func.sum(ProductionRecord.production_volume), 0)).scalar() or 0
    total_area = base.with_entities(
        func.coalesce(func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed), 0)
    ).scalar() or 0
    record_count = base.count()
    total_beds = base.with_entities(func.coalesce(func.sum(ProductionRecord.num_salt_beds), 0)).scalar() or 0
    total_registered = base.with_entities(
        func.coalesce(func.sum(ProductionRecord.registered_producers), 0)
    ).scalar() or 0

    month_rows = (
        base.with_entities(
            func.to_char(ProductionRecord.record_date, "YYYY-MM").label("month"),
            ProductionRecord.barangay_id.label("barangay_id"),
            Barangay.name.label("barangay"),
            func.coalesce(func.sum(ProductionRecord.production_volume), 0).label("volume"),
        )
        .join(Barangay, Barangay.id == ProductionRecord.barangay_id)
        .group_by(
            func.to_char(ProductionRecord.record_date, "YYYY-MM"),
            ProductionRecord.barangay_id,
            Barangay.name,
        )
        .order_by(func.to_char(ProductionRecord.record_date, "YYYY-MM"))
        .all()
    )

    months_set = []
    months_seen = set()
    barangay_names = []
    barangay_seen = set()
    series = {}
    for m, _bid, bname, vol in month_rows:
        if m not in months_seen:
            months_seen.add(m)
            months_set.append(m)
        if bname not in barangay_seen:
            barangay_seen.add(bname)
            barangay_names.append(bname)
            series[bname] = {}
        series[bname][m] = float(vol or 0)

    by_month = []
    for m in months_set:
        row = {"month": m}
        for bname in barangay_names:
            row[bname] = series.get(bname, {}).get(m, 0.0)
        by_month.append(row)

    return jsonify({
        "municipality_id": current_user.municipality_id,
        "municipality_name": current_user.municipality.name if current_user.municipality else None,
        "period": {
            "start": start_d.isoformat() if start_d else None,
            "end": end_d.isoformat() if end_d else None,
        },
        "total_volume_kg": float(total_volume),
        "total_area_sqm": float(total_area or 0),
        "record_count": record_count,
        "total_salt_beds": int(total_beds or 0),
        "total_registered_producers": int(total_registered or 0),
        "by_barangay": [
            {
                "barangay_id": b.barangay_id,
                "barangay": b.name,
                "total_volume_kg": float(b.total_volume or 0),
                "record_count": b.record_count,
                "total_area_sqm": float(b.total_area or 0),
                "total_registered_producers": int(b.total_registered or 0),
            }
            for b in by_barangay
        ],
        "by_month": by_month,
        "barangays": barangay_names,
    })
