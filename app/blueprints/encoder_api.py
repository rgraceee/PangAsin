# WHAT: Encoder API endpoints (barangays, records CRUD, submit, stats, months).
# WHY: Nasa isang blueprint lahat ng ginagawa ng municipal encoder sa records.
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from app.models.production_record import ProductionRecord, PRODUCTION_METHODS
from app.models.barangay import Barangay
from app.models.environment_report import EnvironmentReport, ENVIRONMENT_METHODS
from app.models.producer_report import ProducerReport, ProducerReportEntry
from app.extensions import db
from datetime import datetime, date, timedelta
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.constants import AGE_BUCKET_FIELDS
from app.utils import _parse_date

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
        **{f: getattr(record, f) for f in AGE_BUCKET_FIELDS},
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


def _allocate(record, data):
    if "barangay_id" in data:
        record.barangay_id = data["barangay_id"]
    date_str = data.get("record_date")
    if date_str:
        record.record_date = _parse_date(date_str)
    for field in ("production_volume", "num_salt_beds") + PRODUCER_COUNT_FIELDS:
        if field in data:
            setattr(record, field, data[field])
    for field in AGE_BUCKET_FIELDS:
        if field in data and data[field] not in (None, ""):
            setattr(record, field, data[field])
    if "area_per_salt_bed" in data:
        record.area_per_salt_bed = data["area_per_salt_bed"] if data["area_per_salt_bed"] not in (None, "") else None
    if "production_method" in data:
        record.production_method = data["production_method"]


def _validate(data, partial=False, existing_record=None):
    # WHAT: Validate one record's incoming payload before save/update.
    # WHY: Pinipigilan ang malisya/mali na data; partial=True kapag update lamang.
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

    if not partial or "num_salt_beds" in data or "barangay_id" in data:
        value = data.get("num_salt_beds", existing_record.num_salt_beds if existing_record else None)
        beds_used = None
        if value in (None, ""):
            errors.append("num_salt_beds is required.")
        else:
            try:
                beds_used = int(value)
                if beds_used <= 0:
                    errors.append("num_salt_beds must be positive.")
            except (TypeError, ValueError):
                errors.append("num_salt_beds must be an integer.")
        barangay_id = data.get("barangay_id", existing_record.barangay_id if existing_record else None)
        if beds_used is not None and barangay_id:
            environment_report = (
                EnvironmentReport.query
                .filter_by(
                    municipality_id=current_user.municipality_id,
                    barangay_id=barangay_id,
                    status="approved",
                )
                .order_by(EnvironmentReport.created_at.desc(), EnvironmentReport.id.desc())
                .first()
            )
            if environment_report and beds_used > environment_report.num_salt_beds:
                errors.append(
                    f"Beds used cannot exceed the {environment_report.num_salt_beds} available beds for this barangay."
                )

    for field in PRODUCER_COUNT_FIELDS:
        if field in data:
            value = data.get(field)
            if value in (None, ""):
                errors.append(f"{field} is required.")
            else:
                try:
                    if int(value) < 0:
                        errors.append(f"{field} must be non-negative.")
                except (TypeError, ValueError):
                    errors.append(f"{field} must be an integer.")

    for field in AGE_BUCKET_FIELDS:
        if field in data and data[field] not in (None, ""):
            try:
                if int(data[field]) < 0:
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


@encoder_api_bp.route("/barangays", methods=["POST"])
@login_required
def create_barangay():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    if not current_user.municipality_id:
        return jsonify({"error": "No municipality assigned."}), 400

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Barangay name is required."}), 400
    if len(name) > 100:
        return jsonify({"error": "Barangay name must be 100 characters or fewer."}), 400

    barangay = Barangay(municipality_id=current_user.municipality_id, name=name)
    db.session.add(barangay)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "That barangay already exists in your municipality."}), 409
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not add the barangay. Please try again."}), 500
    return jsonify({"id": barangay.id, "name": barangay.name}), 201


def _serialize_environment_report(report):
    return {
        "id": report.id,
        "report_type": "environment",
        "municipality_id": report.municipality_id,
        "barangay_id": report.barangay_id,
        "barangay": report.barangay.name if report.barangay else None,
        "num_salt_beds": report.num_salt_beds,
        "area_per_salt_bed": float(report.area_per_salt_bed),
        "production_methods": report.production_methods or [],
        "production_area_size": float(report.production_area_size),
        "status": report.status,
        "reviewer_comment": report.reviewer_comment,
        "submitted_at": report.submitted_at.isoformat() if report.submitted_at else None,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


def _serialize_producer_report(report):
    return {
        "id": report.id,
        "report_type": "producer",
        "municipality_id": report.municipality_id,
        "status": report.status,
        "reviewer_comment": report.reviewer_comment,
        "submitted_at": report.submitted_at.isoformat() if report.submitted_at else None,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "entries": [
            {
                "id": entry.id,
                "barangay_id": entry.barangay_id,
                "barangay": entry.barangay.name if entry.barangay else None,
                "name": entry.name,
                "age": entry.age,
                "age_bracket": entry.age_bracket,
                "sex": entry.sex,
                "address": entry.address,
            }
            for entry in report.entries
        ],
    }


@encoder_api_bp.route("/environment-reports", methods=["GET"])
@login_required
def list_environment_reports():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    if not current_user.municipality_id:
        return jsonify({"error": "No municipality assigned."}), 400

    reports = (
        EnvironmentReport.query.filter_by(municipality_id=current_user.municipality_id)
        .order_by(EnvironmentReport.created_at.desc(), EnvironmentReport.id.desc())
        .all()
    )
    return jsonify({"reports": [_serialize_environment_report(report) for report in reports]})


@encoder_api_bp.route("/environment-reports", methods=["POST"])
@login_required
def create_environment_report():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    if not current_user.municipality_id:
        return jsonify({"error": "No municipality assigned."}), 400

    data = request.get_json(silent=True) or {}
    errors = []
    try:
        barangay_id = int(data.get("barangay_id"))
    except (TypeError, ValueError):
        barangay_id = None
        errors.append("Select a barangay.")

    barangay = db.session.get(Barangay, barangay_id) if barangay_id else None
    if barangay_id and (not barangay or barangay.municipality_id != current_user.municipality_id):
        errors.append("Select a barangay in your municipality.")

    try:
        num_salt_beds = int(data.get("num_salt_beds"))
        if num_salt_beds <= 0:
            errors.append("Number of salt beds must be greater than zero.")
    except (TypeError, ValueError):
        num_salt_beds = None
        errors.append("Number of salt beds must be a whole number.")

    numeric_values = {}
    for field, label in (
        ("area_per_salt_bed", "Area per salt bed"),
        ("production_area_size", "Production area size"),
    ):
        try:
            numeric_values[field] = float(data.get(field))
            if numeric_values[field] < 0:
                errors.append(f"{label} cannot be negative.")
        except (TypeError, ValueError):
            errors.append(f"{label} must be a number.")

    methods = data.get("production_methods")
    if not isinstance(methods, list) or not methods:
        methods = []
        errors.append("Select at least one production method.")
    elif any(method not in ENVIRONMENT_METHODS for method in methods):
        errors.append(f"Production methods must be selected from: {', '.join(ENVIRONMENT_METHODS)}.")
    else:
        methods = sorted(set(methods))

    if errors:
        return jsonify({"errors": errors}), 400

    report = EnvironmentReport(
        municipality_id=current_user.municipality_id,
        barangay_id=barangay.id,
        num_salt_beds=num_salt_beds,
        area_per_salt_bed=numeric_values["area_per_salt_bed"],
        production_methods=methods,
        production_area_size=numeric_values["production_area_size"],
        submitted_by=current_user.id,
        status="pending",
        submitted_at=datetime.utcnow(),
    )
    db.session.add(report)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Failed to commit environment report for municipality %s", current_user.municipality_id)
        return jsonify({"error": "Could not submit the environment report. Please try again."}), 500
    return jsonify(_serialize_environment_report(report)), 201


@encoder_api_bp.route("/producer-reports", methods=["GET"])
@login_required
def list_producer_reports():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    if not current_user.municipality_id:
        return jsonify({"error": "No municipality assigned."}), 400

    reports = (
        ProducerReport.query.filter_by(municipality_id=current_user.municipality_id)
        .order_by(ProducerReport.created_at.desc(), ProducerReport.id.desc())
        .all()
    )
    return jsonify({"reports": [_serialize_producer_report(report) for report in reports]})


@encoder_api_bp.route("/producer-reports", methods=["POST"])
@login_required
def create_producer_report():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    if not current_user.municipality_id:
        return jsonify({"error": "No municipality assigned."}), 400

    data = request.get_json(silent=True) or {}
    entries = data.get("entries")
    if not isinstance(entries, list) or not entries:
        return jsonify({"errors": ["Add at least one producer to the report."]}), 400

    errors = []
    normalized = []
    sexes = {"Male", "Female", "Other"}
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            errors.append(f"Producer {index} is invalid.")
            continue
        try:
            barangay_id = int(entry.get("barangay_id"))
        except (TypeError, ValueError):
            barangay_id = None
        barangay = db.session.get(Barangay, barangay_id) if barangay_id else None
        if not barangay or barangay.municipality_id != current_user.municipality_id:
            errors.append(f"Producer {index} must have a barangay in your municipality.")

        name = (entry.get("name") or "").strip()
        raw_age = entry.get("age")
        try:
            if isinstance(raw_age, bool) or isinstance(raw_age, float) and not raw_age.is_integer():
                raise ValueError
            age = int(raw_age)
            if age < 0 or age > 120:
                errors.append(f"Producer {index} age must be between 0 and 120.")
        except (TypeError, ValueError):
            age = None
            errors.append(f"Producer {index} age must be a whole number.")
        sex = entry.get("sex")
        address = (entry.get("address") or "").strip()
        if not name or len(name) > 150:
            errors.append(f"Producer {index} name is required and must be 150 characters or fewer.")
        if sex not in sexes:
            errors.append(f"Producer {index} sex is invalid.")
        if not address or len(address) > 255:
            errors.append(f"Producer {index} address is required and must be 255 characters or fewer.")
        normalized.append({
            "barangay": barangay,
            "name": name,
            "age": age,
            "sex": sex,
            "address": address,
        })

    if errors:
        return jsonify({"errors": errors}), 400

    report = ProducerReport(
        municipality_id=current_user.municipality_id,
        submitted_by=current_user.id,
        status="pending",
        submitted_at=datetime.utcnow(),
    )
    report.entries = [
        ProducerReportEntry(
            barangay=entry["barangay"],
            name=entry["name"],
            age=entry["age"],
            sex=entry["sex"],
            address=entry["address"],
        )
        for entry in normalized
    ]
    db.session.add(report)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Failed to commit producer report for municipality %s", current_user.municipality_id)
        return jsonify({"error": "Could not submit the producer report. Please try again."}), 500
    return jsonify(_serialize_producer_report(report)), 201


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
        status="pending",
        submitted_at=datetime.utcnow(),
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
    errors = _validate(data, partial=True, existing_record=record)
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


@encoder_api_bp.route("/months", methods=["GET"])
@login_required
def encoder_months():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    rows = (
        db.session.query(
            func.to_char(ProductionRecord.record_date, "YYYY-MM").label("month"),
        )
        .filter(ProductionRecord.municipality_id == current_user.municipality_id)
        .distinct()
        .order_by(func.to_char(ProductionRecord.record_date, "YYYY-MM"))
        .all()
    )
    months = [r.month for r in rows if r.month]
    now = date.today()
    current_ym = f"{now.year:04d}-{now.month:02d}"
    if current_ym not in months:
        months.append(current_ym)
    months = sorted(set(months))
    return jsonify({"months": months})


@encoder_api_bp.route("/stats", methods=["GET"])
@login_required
def stats():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403

    month = request.args.get("month")
    if month:
        try:
            month_start = datetime.strptime(month, "%Y-%m").date()
            if month_start.month == 12:
                month_end = date(month_start.year + 1, 1, 1)
            else:
                month_end = date(month_start.year, month_start.month + 1, 1)
        except (TypeError, ValueError):
            return jsonify({"error": "month must be in YYYY-MM format."}), 400
        base = ProductionRecord.query.filter_by(municipality_id=current_user.municipality_id).filter(
            ProductionRecord.record_date >= month_start,
            ProductionRecord.record_date < month_end,
        )
        by_barangay_q = (
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
            .filter(ProductionRecord.record_date >= month_start)
            .filter(ProductionRecord.record_date < month_end)
            .group_by(ProductionRecord.barangay_id, Barangay.name)
            .all()
        )
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
        total_volume = base.with_entities(func.coalesce(func.sum(ProductionRecord.production_volume), 0)).scalar() or 0
        total_area = base.with_entities(
            func.coalesce(func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed), 0)
        ).scalar() or 0
        record_count = base.count()
        total_beds = base.with_entities(func.coalesce(func.sum(ProductionRecord.num_salt_beds), 0)).scalar() or 0
        total_registered = base.with_entities(
            func.coalesce(func.sum(ProductionRecord.registered_producers), 0)
        ).scalar() or 0
        return jsonify({
            "municipality_id": current_user.municipality_id,
            "municipality_name": current_user.municipality.name if current_user.municipality else None,
            "period": {
                "start": month_start.isoformat(),
                "end": (month_end - timedelta(days=1)).isoformat(),
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
                for b in by_barangay_q
            ],
            "by_month": by_month,
            "barangays": barangay_names,
        })

    base = ProductionRecord.query.filter_by(municipality_id=current_user.municipality_id)
    start_raw = request.args.get("start")
    end_raw = request.args.get("end")
    base, start_d, end_d = _apply_period(base, start_raw, end_raw)

    by_barangay_q = _by_barangay_query()
    by_barangay_q, _, _ = _apply_period(by_barangay_q, start_raw, end_raw)
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
