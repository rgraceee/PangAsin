# WHAT: Admin-only API endpoints (users, records review, stats, data quality,
#       insight, supply-demand, months).
# WHY: Lahat ng admin actions ay nasa isang lugar, may iisang _admin_only guard.
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
import os
from app.models.production_record import ProductionRecord
from app.models.environment_report import EnvironmentReport
from app.models.producer_report import ProducerReport, ProducerReportEntry
from app.models.producer import Producer
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.municipality_production import MunicipalityMonthlyProduction
from app.models.user import User
from app.models.demand_benchmark import DemandBenchmark
from app.models.audit_log import AuditLog
from app.extensions import db
from datetime import datetime, date, timedelta
from sqlalchemy import func
from app.services.data_quality import build_data_quality, DATA_QUALITY_RANGES
from app.services.aggregates import _last_month_with_data
from app.services import municipality_service
from app.services import geojson_service
from app.services.audit import log_action
from app.services.date_math import shift_month, month_bounds
from app.services.municipality_service import (
    MunicipalityConflictError,
    MunicipalityValidationError,
)
from app.services.municipalities import active_municipality_ids_subquery
from app.constants import AGE_BUCKET_FIELDS, SECTOR_DEMAND, SECTOR_DEMAND_NOTE
from app.status_constants import ALLOWED_STATUSES
from app.utils import _admin_only

admin_api_bp = Blueprint("admin_api", __name__, url_prefix="/api/admin")


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
        "production_volume_mt": float(record.production_volume_mt) if record.production_volume_mt is not None else None,
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
        "output_per_bed": round(float(record.production_volume_mt) / record.num_salt_beds, 3)
        if record.production_volume_mt is not None and record.num_salt_beds
        else None,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


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
        "must_change_password": current_user.must_change_password,
    })


@admin_api_bp.route("/municipalities", methods=["GET"])
@login_required
def list_municipalities():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    return jsonify({
        "municipalities": municipality_service.list_municipalities_with_summaries(),
    })


@admin_api_bp.route("/municipalities", methods=["POST"])
@login_required
def create_municipality():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    data = request.get_json(silent=True) or {}
    try:
        municipality, encoder_result = municipality_service.create_municipality(data)
    except MunicipalityValidationError as exc:
        return jsonify({"errors": exc.errors}), exc.status_code
    except MunicipalityConflictError as exc:
        return jsonify({"error": str(exc)}), exc.status_code

    return jsonify({
        "municipality": municipality_service.serialize_municipality(municipality),
        "encoder": encoder_result,
    }), 201


@admin_api_bp.route("/municipalities/<int:municipality_id>", methods=["PATCH"])
@login_required
def update_municipality(municipality_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    municipality = db.session.get(Municipality, municipality_id)
    if not municipality:
        return jsonify({"error": "Municipality not found."}), 404

    data = request.get_json(silent=True) or {}
    try:
        municipality, deactivated = municipality_service.update_municipality(
            municipality, data
        )
    except MunicipalityValidationError as exc:
        return jsonify({"errors": exc.errors}), exc.status_code
    except MunicipalityConflictError as exc:
        return jsonify({"error": str(exc)}), exc.status_code

    return jsonify({
        "municipality": municipality_service.serialize_municipality(municipality),
        "deactivated_encoder_count": deactivated,
    })


@admin_api_bp.route("/municipalities/seed", methods=["POST"])
@login_required
def seed_municipalities():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    data = request.get_json(silent=True) or {}
    try:
        result = municipality_service.seed_municipalities(
            dry_run=bool(data.get("dry_run"))
        )
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        return jsonify({"error": f"Could not seed municipalities: {exc}"}), 500
    return jsonify(result)


@admin_api_bp.route("/municipalities/<int:municipality_id>", methods=["DELETE"])
@login_required
def delete_municipality(municipality_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    municipality = db.session.get(Municipality, municipality_id)
    if not municipality:
        return jsonify({"error": "Municipality not found."}), 404

    data = request.get_json(silent=True) or {}
    confirm_name = str(data.get("confirm_name") or "").strip()
    if confirm_name.lower() != municipality.name.lower():
        return jsonify({
            "error": "Type the municipality name exactly to confirm deletion."
        }), 400

    try:
        counts = municipality_service.delete_municipality(
            municipality, force=bool(data.get("force"))
        )
    except MunicipalityConflictError as exc:
        return jsonify({"error": str(exc), "code": "municipality_has_data"}), exc.status_code
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        return jsonify({"error": f"Could not delete the municipality: {exc}"}), 500

    return jsonify({"ok": True, "deleted": counts})


@admin_api_bp.route("/municipalities/<int:municipality_id>/geojson", methods=["POST"])
@login_required
def upload_municipality_geojson(municipality_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    municipality = db.session.get(Municipality, municipality_id)
    if not municipality:
        return jsonify({"error": "Municipality not found."}), 404

    file_storage = request.files.get("file")
    try:
        geojson_ref, feature_count = geojson_service.save_municipality_geojson(
            municipality, file_storage
        )
    except MunicipalityValidationError as exc:
        return jsonify({"errors": exc.errors}), exc.status_code

    municipality.geojson_ref = geojson_ref
    log_action(
        "municipality.geojson.upload",
        "municipality",
        municipality.id,
        summary=f"Uploaded a boundary for {municipality.name}.",
        details={"geojson_ref": geojson_ref, "feature_count": feature_count},
    )
    try:
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        return jsonify({"error": f"Could not save the boundary: {exc}"}), 500

    return jsonify({
        "municipality": municipality_service.serialize_municipality(municipality),
        "feature_count": feature_count,
    })


@admin_api_bp.route("/municipalities/<int:municipality_id>/geojson", methods=["DELETE"])
@login_required
def delete_municipality_geojson(municipality_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    municipality = db.session.get(Municipality, municipality_id)
    if not municipality:
        return jsonify({"error": "Municipality not found."}), 404

    ref = municipality.geojson_ref
    removed = False
    if ref and ref.startswith("geojson/"):
        path = geojson_service.geojson_path(ref)
        if os.path.isfile(path):
            try:
                os.remove(path)
                removed = True
            except OSError as exc:
                return jsonify({"error": f"Could not remove the file: {exc}"}), 500
    municipality.geojson_ref = None
    log_action(
        "municipality.geojson.delete",
        "municipality",
        municipality.id,
        summary=f"Removed the uploaded boundary for {municipality.name}.",
        details={"geojson_ref": ref, "file_removed": removed},
    )
    db.session.commit()
    return jsonify({
        "ok": True,
        "file_removed": removed,
        "municipality": municipality_service.serialize_municipality(municipality),
    })


@admin_api_bp.route("/barangays/<int:barangay_id>", methods=["PATCH"])
@login_required
def rename_barangay(barangay_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    barangay = db.session.get(Barangay, barangay_id)
    if not barangay:
        return jsonify({"error": "Barangay not found."}), 404

    data = request.get_json(silent=True) or {}
    try:
        barangay = municipality_service.rename_barangay(barangay, data.get("name"))
    except MunicipalityValidationError as exc:
        return jsonify({"errors": exc.errors}), exc.status_code
    except MunicipalityConflictError as exc:
        return jsonify({"error": str(exc)}), exc.status_code

    return jsonify({"barangay": municipality_service.serialize_barangay(barangay)})


@admin_api_bp.route("/barangays/<int:barangay_id>", methods=["DELETE"])
@login_required
def delete_barangay(barangay_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    barangay = db.session.get(Barangay, barangay_id)
    if not barangay:
        return jsonify({"error": "Barangay not found."}), 404

    try:
        municipality_service.delete_barangay(barangay)
    except MunicipalityConflictError as exc:
        return jsonify({"error": str(exc), "code": "barangay_in_use"}), exc.status_code

    return jsonify({"ok": True})


@admin_api_bp.route("/audit-logs", methods=["GET"])
@login_required
def list_audit_logs():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    page = max(1, request.args.get("page", 1, type=int) or 1)
    per_page = min(200, max(1, request.args.get("per_page", 50, type=int) or 50))
    query = AuditLog.query

    action = (request.args.get("action") or "").strip()
    entity_type = (request.args.get("entity_type") or "").strip()
    actor_email = (request.args.get("actor_email") or "").strip().lower()
    entity_id = request.args.get("entity_id", type=int)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if actor_email:
        query = query.filter(func.lower(AuditLog.actor_email).like(f"%{actor_email}%"))
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return jsonify({
        "logs": [entry.serialize() for entry in logs],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page if per_page else 0,
    })


@admin_api_bp.route("/barangays", methods=["GET"])
@login_required
def list_barangays():
    # WHAT: Read-only source ng lahat ng barangay para sa admin filters.
    # WHY: /encoder/barangays ay encoder-only at scoped sa assigned municipality,
    #      kaya kailangan ng admin-wide list para sa dependent dropdown.
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    barangays = (
        Barangay.query
        .filter(Barangay.municipality_id.in_(active_municipality_ids_subquery()))
        .order_by(Barangay.name)
        .all()
    )
    return jsonify({
        "barangays": [
            {
                "id": b.id,
                "name": b.name,
                "municipality_id": b.municipality_id,
            }
            for b in barangays
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
                "must_change_password": u.must_change_password,
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
    # Encoder accounts are created when a municipality is added; the manual
    # add-user flow has been removed. New accounts cannot be created here.
    return jsonify({
        "error": "Creating encoder accounts directly is no longer supported. Accounts are created when a municipality is added."
    }), 400


_USER_AUDIT_FIELDS = ("name", "municipality_id", "status", "role")


def _user_snapshot(user):
    # WHAT: Copy the auditable fields before applying an update.
    # WHY: The audit entry needs the before/after values, and the ORM objects
    #      mutate in place, so the snapshot must be taken first.
    return {field: getattr(user, field) for field in _USER_AUDIT_FIELDS}


def _apply_user_name(user, data, errors):
    if "name" not in data:
        return
    name = (data.get("name") or "").strip()
    if not name:
        errors.append("name cannot be empty.")
        return
    user.name = name


def _apply_user_municipality(user, data, errors):
    if "municipality_id" not in data:
        return
    municipality_id = data.get("municipality_id")
    # WHAT: Encoders must always point at a real municipality.
    # WHY: Admin accounts may stay unassigned, so only encoders are validated.
    if user.role != "encoder":
        user.municipality_id = municipality_id
        return
    if not municipality_id:
        errors.append("municipality_id is required for encoder accounts.")
    elif not Municipality.query.get(municipality_id):
        errors.append("municipality_id is invalid.")
    else:
        user.municipality_id = municipality_id


def _apply_user_status(user, data, errors):
    if "status" not in data:
        return
    status = data.get("status")
    if status not in ("active", "inactive"):
        errors.append("status must be active or inactive.")
        return
    user.status = status


def _apply_user_password(user, data, errors):
    # WHAT: Set a new password when one was supplied.
    # WHY: Return whether it changed so the audit entry can record it.
    password = data.get("password")
    if not password:
        return False
    if len(password) < 6:
        errors.append("password must be at least 6 chars.")
        return False
    user.set_password(password)
    return True


@admin_api_bp.route("/users/<int:user_id>", methods=["PATCH"])
@login_required
def update_user(user_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json(silent=True) or {}
    errors = []
    before = _user_snapshot(user)

    _apply_user_name(user, data, errors)
    _apply_user_municipality(user, data, errors)
    _apply_user_status(user, data, errors)
    password_changed = _apply_user_password(user, data, errors)

    if errors:
        return jsonify({"errors": errors}), 400

    after = _user_snapshot(user)
    changed = {
        key: {"from": before[key], "to": after[key]}
        for key in before
        if before[key] != after[key]
    }
    if changed or password_changed:
        log_action(
            "user.update",
            "user",
            user.id,
            summary=f"Updated account {user.email}.",
            details={
                "changes": changed,
                "password_changed": password_changed,
            },
        )

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
        "must_change_password": user.must_change_password,
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
    page = request.args.get("page", type=int)
    limit = request.args.get("per_page", type=int) or request.args.get("limit", type=int)

    if status:
        if status not in ALLOWED_STATUSES:
            return jsonify({"error": f"status must be one of: {', '.join(ALLOWED_STATUSES)}."}), 400
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

    total = query.count()

    # WHAT: The ids of every pending row in this filter, not only this page.
    # WHY: Validation Queue "Select all" must select the whole filtered queue;
    #      a page-only selection would silently approve a different set.
    selectable_ids = []
    if request.args.get("ids"):
        selectable_ids = [
            row[0]
            for row in (
                query.filter(ProductionRecord.status == "pending")
                .with_entities(ProductionRecord.id)
                .order_by(ProductionRecord.id)
                .all()
            )
        ]

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
        "per_page": limit,
        "pages": (total + limit - 1) // limit if page and limit else (1 if total else 0),
        "selectable_ids": selectable_ids,
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


def _report_review_status(data):
    status = (data.get("status") or "").strip()
    if status not in ("approved", "rejected"):
        return None, jsonify({"error": "status must be 'approved' or 'rejected'."}), 400
    return status, None, None


def _serialize_environment_submission(report):
    submitter = db.session.get(User, report.submitted_by)
    reviewer = db.session.get(User, report.reviewed_by) if report.reviewed_by else None
    return {
        "id": report.id,
        "report_type": "environment",
        "municipality_id": report.municipality_id,
        "municipality_name": report.barangay.municipality.name if report.barangay and report.barangay.municipality else None,
        "barangay_id": report.barangay_id,
        "barangay": report.barangay.name if report.barangay else None,
        "num_salt_beds": report.num_salt_beds,
        "area_per_salt_bed": float(report.area_per_salt_bed),
        "production_methods": report.production_methods or [],
        "production_area_size": float(report.production_area_size),
        "status": report.status,
        "reviewer_comment": report.reviewer_comment,
        "submitted_by": report.submitted_by,
        "submitter": {"id": submitter.id, "name": submitter.name, "email": submitter.email} if submitter else None,
        "submitted_at": report.submitted_at.isoformat() if report.submitted_at else None,
        "reviewed_by": report.reviewed_by,
        "reviewer": {"id": reviewer.id, "name": reviewer.name, "email": reviewer.email} if reviewer else None,
        "reviewed_at": report.reviewed_at.isoformat() if report.reviewed_at else None,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


def _serialize_producer_submission(report):
    submitter = db.session.get(User, report.submitted_by)
    reviewer = db.session.get(User, report.reviewed_by) if report.reviewed_by else None
    municipality = db.session.get(Municipality, report.municipality_id)
    return {
        "id": report.id,
        "report_type": "producer",
        "municipality_id": report.municipality_id,
        "municipality_name": municipality.name if municipality else None,
        "status": report.status,
        "reviewer_comment": report.reviewer_comment,
        "submitted_by": report.submitted_by,
        "submitter": {"id": submitter.id, "name": submitter.name, "email": submitter.email} if submitter else None,
        "submitted_at": report.submitted_at.isoformat() if report.submitted_at else None,
        "reviewed_by": report.reviewed_by,
        "reviewer": {"id": reviewer.id, "name": reviewer.name, "email": reviewer.email} if reviewer else None,
        "reviewed_at": report.reviewed_at.isoformat() if report.reviewed_at else None,
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
            }
            for entry in report.entries
        ],
    }


@admin_api_bp.route("/environment-reports", methods=["GET"])
@login_required
def list_environment_submissions():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    query = EnvironmentReport.query
    status = request.args.get("status")
    municipality_id = request.args.get("municipality_id", type=int)
    barangay_id = request.args.get("barangay_id", type=int)
    if status:
        if status not in ALLOWED_STATUSES:
            return jsonify({"error": f"status must be one of: {', '.join(ALLOWED_STATUSES)}."}), 400
        query = query.filter(EnvironmentReport.status == status)
    if municipality_id:
        query = query.filter(EnvironmentReport.municipality_id == municipality_id)
    if barangay_id:
        query = query.filter(EnvironmentReport.barangay_id == barangay_id)

    total = query.count()
    pages = 0
    page = request.args.get("page", type=int)
    limit = request.args.get("per_page", type=int) or request.args.get("limit", type=int)
    ordered = query.order_by(EnvironmentReport.created_at.desc(), EnvironmentReport.id.desc())
    if page and limit and page > 0 and limit > 0:
        reports = ordered.offset((page - 1) * limit).limit(limit).all()
        pages = (total + limit - 1) // limit
    else:
        reports = ordered.all()
        pages = 1 if total else 0

    # WHAT: Every pending report id in this filter, for "Select all".
    selectable_ids = []
    if request.args.get("ids"):
        selectable_ids = [
            row[0]
            for row in (
                query.filter(EnvironmentReport.status == "pending")
                .with_entities(EnvironmentReport.id)
                .order_by(EnvironmentReport.id)
                .all()
            )
        ]

    return jsonify({
        "reports": [_serialize_environment_submission(report) for report in reports],
        "total": total,
        "page": page,
        "limit": limit,
        "per_page": limit,
        "pages": pages,
        "selectable_ids": selectable_ids,
    })


@admin_api_bp.route("/environment-reports/<int:report_id>/review", methods=["PATCH", "POST"])
@login_required
def review_environment_submission(report_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    report = db.session.get(EnvironmentReport, report_id)
    if not report:
        return jsonify({"error": "Environment report not found."}), 404
    if report.status != "pending":
        return jsonify({"error": f"Only pending reports can be reviewed. Current status: {report.status}."}), 409
    status, error_response, error_status = _report_review_status(request.get_json(silent=True) or {})
    if error_response:
        return error_response, error_status
    report.status = status
    report.reviewer_comment = (request.get_json(silent=True) or {}).get("reviewer_comment") or None
    report.reviewed_by = current_user.id
    report.reviewed_at = datetime.utcnow()
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not save the Environment report review."}), 500
    return jsonify(_serialize_environment_submission(report))


@admin_api_bp.route("/producer-reports", methods=["GET"])
@login_required
def list_producer_submissions():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    query = ProducerReport.query
    status = request.args.get("status")
    municipality_id = request.args.get("municipality_id", type=int)
    barangay_id = request.args.get("barangay_id", type=int)
    if status:
        if status not in ALLOWED_STATUSES:
            return jsonify({"error": f"status must be one of: {', '.join(ALLOWED_STATUSES)}."}), 400
        query = query.filter(ProducerReport.status == status)
    if municipality_id:
        query = query.filter(ProducerReport.municipality_id == municipality_id)
    if barangay_id:
        # WHAT: Match reports that have at least one entry in the barangay.
        # WHY: a salt-farmer report is municipality-level, so barangay scope
        #      lives on its entries; distinct avoids duplicate reports.
        query = (
            query.join(ProducerReportEntry, ProducerReportEntry.report_id == ProducerReport.id)
            .filter(ProducerReportEntry.barangay_id == barangay_id)
            .distinct()
        )

    total = query.count()
    pages = 0
    page = request.args.get("page", type=int)
    limit = request.args.get("per_page", type=int) or request.args.get("limit", type=int)
    ordered = query.order_by(ProducerReport.created_at.desc(), ProducerReport.id.desc())
    if page and limit and page > 0 and limit > 0:
        reports = ordered.offset((page - 1) * limit).limit(limit).all()
        pages = (total + limit - 1) // limit
    else:
        reports = ordered.all()
        pages = 1 if total else 0

    # WHAT: Every pending report id in this filter, for "Select all".
    selectable_ids = []
    if request.args.get("ids"):
        selectable_ids = [
            row[0]
            for row in (
                query.filter(ProducerReport.status == "pending")
                .with_entities(ProducerReport.id)
                .order_by(ProducerReport.id)
                .all()
            )
        ]

    return jsonify({
        "reports": [_serialize_producer_submission(report) for report in reports],
        "total": total,
        "page": page,
        "limit": limit,
        "per_page": limit,
        "pages": pages,
        "selectable_ids": selectable_ids,
    })


@admin_api_bp.route("/producer-reports/<int:report_id>/review", methods=["PATCH", "POST"])
@login_required
def review_producer_submission(report_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    report = db.session.get(ProducerReport, report_id)
    if not report:
        return jsonify({"error": "Salt farmer report not found."}), 404
    if report.status != "pending":
        return jsonify({"error": f"Only pending reports can be reviewed. Current status: {report.status}."}), 409
    data = request.get_json(silent=True) or {}
    status, error_response, error_status = _report_review_status(data)
    if error_response:
        return error_response, error_status
    report.status = status
    report.reviewer_comment = data.get("reviewer_comment") or None
    report.reviewed_by = current_user.id
    report.reviewed_at = datetime.utcnow()
    if status == "approved":
        for entry in report.entries:
            existing = Producer.query.filter(
                Producer.barangay_id == entry.barangay_id,
                func.lower(Producer.name) == entry.name.strip().lower(),
            ).first()
            if existing:
                existing.age = entry.age
                existing.age_bracket = entry.age_bracket
                existing.sex = entry.sex
            else:
                db.session.add(Producer(
                    barangay_id=entry.barangay_id,
                    name=entry.name.strip(),
                    age=entry.age,
                    age_bracket=entry.age_bracket,
                    sex=entry.sex,
                ))
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not save the salt farmer report review."}), 500
    return jsonify(_serialize_producer_submission(report))


def _resolve_active_municipality():
    """Resolve the optional ``municipality`` query param to an active row.

    WHAT: The dashboard selector sends the slug used by the encoder account
          (e.g. ``bolinao``, ``alaminos``), never a display name.
    WHY: A slug is stable and URL-safe; validating it against the active
         directory here keeps inactive or unknown municipalities out of the
         dashboard data instead of silently returning an empty province.
    """
    raw_slug = (request.args.get("municipality") or "").strip().lower()
    if not raw_slug:
        return None, None
    municipality = next(
        (
            row for row in Municipality.query.filter_by(status="active").all()
            if municipality_service.slugify(row.name) == raw_slug
        ),
        None,
    )
    if municipality is None:
        return None, (
            jsonify({"error": "municipality must be an active municipality slug."}),
            400,
        )
    return municipality, None


def _stats_scope_conditions(column, municipality_id):
    # WHAT: No filter for province-wide scope, one equality filter otherwise.
    # WHY: Every stats query applies the same dashboard municipality selector.
    if municipality_id is None:
        return []
    return [column == municipality_id]


_AGE_BANDS = ("18-30", "31-40", "41-50", "51-60", "61+")


def _age_band_for(age):
    # WHAT: Map an exact age to its dashboard band.
    # WHY: The producer master list groups ages in five fixed bands.
    if age <= 30:
        return "18-30"
    if age <= 40:
        return "31-40"
    if age <= 50:
        return "41-50"
    if age <= 60:
        return "51-60"
    return "61+"


def _environment_by_municipality(municipality_id):
    # WHAT: Aggregate approved environment reports per municipality.
    # WHY: The environment panel needs bed, area and method totals in one pass.
    summary = {}
    reports = (
        EnvironmentReport.query.filter_by(status="approved")
        .filter(EnvironmentReport.municipality_id.in_(active_municipality_ids_subquery()))
        .filter(*_stats_scope_conditions(EnvironmentReport.municipality_id, municipality_id))
        .all()
    )
    for report in reports:
        name = (
            report.barangay.municipality.name
            if report.barangay and report.barangay.municipality
            else "Unknown"
        )
        row = summary.setdefault(report.municipality_id, {
            "municipality_id": report.municipality_id,
            "municipality_name": name,
            "report_count": 0,
            "total_salt_beds": 0,
            "total_production_area_sqm": 0.0,
            "production_methods": {"solar": 0, "cooked": 0, "hybrid": 0},
        })
        row["report_count"] += 1
        row["total_salt_beds"] += report.num_salt_beds
        row["total_production_area_sqm"] += float(report.production_area_size or 0)
        for method in report.production_methods or []:
            if method in row["production_methods"]:
                row["production_methods"][method] += 1
    return summary


def _producer_master_list(municipality_id, municipality_names):
    # WHAT: Aggregate the distinct producer master list per municipality.
    # WHY: Production records repeat head-counts; this list is the real registry.
    master_by_municipality = {}
    rows = (
        db.session.query(Barangay.municipality_id, Producer.age, Producer.sex)
        .join(Producer, Producer.barangay_id == Barangay.id)
        .filter(Barangay.municipality_id.in_(active_municipality_ids_subquery()))
        .filter(*_stats_scope_conditions(Barangay.municipality_id, municipality_id))
        .all()
    )
    for row_municipality_id, age, sex in rows:
        bucket = master_by_municipality.setdefault(row_municipality_id, {
            "producers": 0,
            "age_bands": {band: 0 for band in _AGE_BANDS},
            "sex": {"male": 0, "female": 0, "other": 0},
        })
        bucket["producers"] += 1
        if age is not None:
            bucket["age_bands"][_age_band_for(age)] += 1
        bucket["sex"][{"Male": "male", "Female": "female"}.get(sex, "other")] += 1

    return [
        {
            "municipality_id": row_municipality_id,
            "municipality_name": municipality_names.get(row_municipality_id, "Unknown"),
            "producers": bucket["producers"],
            "age_bands": bucket["age_bands"],
            "sex": bucket["sex"],
        }
        for row_municipality_id, bucket in sorted(
            master_by_municipality.items(),
            key=lambda item: municipality_names.get(item[0], "").lower(),
        )
    ]


def _production_methods_by_municipality(municipality_id, municipality_names):
    # WHAT: Sum approved production volume per method and municipality.
    # WHY: The method panel uses all approved records, not a rolling window.
    rows = (
        db.session.query(
            ProductionRecord.municipality_id,
            ProductionRecord.production_method,
            func.sum(ProductionRecord.production_volume_mt).label("mt"),
        )
        .filter(ProductionRecord.status == "approved")
        .filter(ProductionRecord.municipality_id.in_(active_municipality_ids_subquery()))
        .filter(*_stats_scope_conditions(ProductionRecord.municipality_id, municipality_id))
        .group_by(ProductionRecord.municipality_id, ProductionRecord.production_method)
        .all()
    )
    methods_by_municipality = {}
    for row_municipality_id, method, mt in rows:
        bucket = methods_by_municipality.setdefault(
            row_municipality_id, {"solar": 0.0, "cooked": 0.0, "hybrid": 0.0}
        )
        if method in bucket:
            bucket[method] = round(float(mt or 0), 3)
    return [
        {
            "municipality_id": row_municipality_id,
            "municipality_name": municipality_names.get(row_municipality_id, "Unknown"),
            **bucket,
        }
        for row_municipality_id, bucket in sorted(
            methods_by_municipality.items(),
            key=lambda item: municipality_names.get(item[0], "").lower(),
        )
    ]


def _monthly_production_source(municipality_id, municipality_stats, by_barangay_by_muni):
    # WHAT: Build stats from the workbook-driven monthly production table.
    # WHY: The dashboard can switch its production source without changing the UI.
    year_raw = request.args.get("year")
    month_raw = request.args.get("month")
    try:
        year = int(year_raw) if year_raw is not None else None
        month = int(month_raw) if month_raw is not None else None
    except ValueError:
        return None, (jsonify({"error": "year and month must be valid integers."}), 400)
    if year is not None and not 1 <= year <= 9999:
        return None, (jsonify({"error": "year must be between 1 and 9999."}), 400)
    if month is not None and not 1 <= month <= 12:
        return None, (jsonify({"error": "month must be between 1 and 12."}), 400)

    start_raw = request.args.get("start")
    end_raw = request.args.get("end")
    start = None
    end = None
    if start_raw or end_raw:
        if not (start_raw and end_raw):
            return None, (jsonify({"error": "start and end must be provided together."}), 400)
        try:
            start = datetime.strptime(start_raw, "%Y-%m-%d").date()
            end = datetime.strptime(end_raw, "%Y-%m-%d").date()
        except ValueError:
            return None, (jsonify({"error": "start and end must use YYYY-MM-DD."}), 400)
        if start > end:
            return None, (jsonify({"error": "start must be on or before end."}), 400)

    production_query = db.session.query(
        MunicipalityMonthlyProduction.municipality_id,
        func.sum(MunicipalityMonthlyProduction.production_kg).label("production_kg"),
        func.count(MunicipalityMonthlyProduction.id).label("month_count"),
        func.sum(
            db.case(
                (MunicipalityMonthlyProduction.is_synthetic.is_(True), 1),
                else_=0,
            )
        ).label("synthetic_month_count"),
        func.min(
            func.to_char(
                func.make_date(
                    MunicipalityMonthlyProduction.production_year,
                    MunicipalityMonthlyProduction.production_month,
                    1,
                ),
                "YYYY-MM",
            )
        ).label("start_month"),
        func.max(
            func.to_char(
                func.make_date(
                    MunicipalityMonthlyProduction.production_year,
                    MunicipalityMonthlyProduction.production_month,
                    1,
                ),
                "YYYY-MM",
            )
        ).label("end_month"),
    )
    if year is not None:
        production_query = production_query.filter(
            MunicipalityMonthlyProduction.production_year == year
        )
    if month is not None:
        production_query = production_query.filter(
            MunicipalityMonthlyProduction.production_month == month
        )
    if start is not None:
        production_query = production_query.filter(
            func.make_date(
                MunicipalityMonthlyProduction.production_year,
                MunicipalityMonthlyProduction.production_month,
                1,
            ) >= start.replace(day=1)
        )
    if end is not None:
        production_query = production_query.filter(
            func.make_date(
                MunicipalityMonthlyProduction.production_year,
                MunicipalityMonthlyProduction.production_month,
                1,
            ) <= end.replace(day=1)
        )
    production_rows = (
        production_query
        .filter(
            MunicipalityMonthlyProduction.municipality_id.in_(
                active_municipality_ids_subquery()
            )
        )
        .filter(*_stats_scope_conditions(
            MunicipalityMonthlyProduction.municipality_id, municipality_id
        ))
        .group_by(MunicipalityMonthlyProduction.municipality_id)
        .all()
    )
    production_by_municipality = {
        row.municipality_id: row for row in production_rows
    }
    municipality_stats_by_id = {
        row["municipality_id"]: row for row in municipality_stats
    }
    scoped_municipalities = (
        Municipality.query.filter_by(status="active")
        .filter(*_stats_scope_conditions(Municipality.id, municipality_id))
        .all()
    )
    for municipality in scoped_municipalities:
        row = production_by_municipality.get(municipality.id)
        municipality_stat = municipality_stats_by_id.get(municipality.id)
        if municipality_stat is None:
            municipality_stat = {
                "municipality_id": municipality.id,
                "municipality_name": municipality.name,
                "record_count": 0,
                "total_area_sqm": 0.0,
                "total_salt_beds": 0,
                "total_registered_producers": 0,
                "total_male_producers": 0,
                "total_female_producers": 0,
                "by_barangay": by_barangay_by_muni.get(municipality.id, []),
            }
            municipality_stats.append(municipality_stat)
        municipality_stat["total_volume_mt"] = (
            float(row.production_kg or 0) / 1000.0 if row else 0.0
        )
        municipality_stat["production_month_count"] = (
            int(row.month_count) if row else 0
        )
        municipality_stat["synthetic_month_count"] = (
            int(row.synthetic_month_count or 0) if row else 0
        )

    total_volume = sum(
        float(row.production_kg or 0) / 1000.0
        for row in production_rows
    )
    total_month_count = sum(int(row.month_count) for row in production_rows)
    total_synthetic_month_count = sum(
        int(row.synthetic_month_count or 0) for row in production_rows
    )
    production_period = None
    if production_rows:
        production_period = {
            "start": min(row.start_month for row in production_rows),
            "end": max(row.end_month for row in production_rows),
        }
    return {
        "total_volume": total_volume,
        "total_production_month_count": total_month_count,
        "total_synthetic_month_count": total_synthetic_month_count,
        "production_period": production_period,
        "production_includes_synthetic": total_synthetic_month_count > 0,
    }, None


@admin_api_bp.route("/stats", methods=["GET"])
@login_required
def stats():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    production_source = request.args.get("source", "approved_records")
    if production_source not in ("approved_records", "municipality_production"):
        return jsonify({
            "error": "source must be approved_records or municipality_production."
        }), 400

    selected_municipality, municipality_error = _resolve_active_municipality()
    if municipality_error:
        return municipality_error
    selected_municipality_id = (
        selected_municipality.id if selected_municipality is not None else None
    )

    def scope_conditions(column):
        # WHAT: No filter for province-wide scope, one condition otherwise.
        # WHY: Every stats query applies the same dashboard municipality selector.
        return _stats_scope_conditions(column, selected_municipality_id)

    by_municipality = (
        db.session.query(
            ProductionRecord.municipality_id,
            Municipality.name,
            func.sum(ProductionRecord.production_volume_mt).label("total_volume"),
            func.count(ProductionRecord.id).label("record_count"),
            func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed).label("total_area"),
            func.sum(ProductionRecord.num_salt_beds).label("total_beds"),
            func.sum(ProductionRecord.registered_producers).label("total_registered"),
            func.sum(ProductionRecord.male_producers).label("total_male"),
            func.sum(ProductionRecord.female_producers).label("total_female"),
        )
        .join(Municipality, Municipality.id == ProductionRecord.municipality_id)
        .filter(ProductionRecord.status == "approved")
        .filter(Municipality.status == "active")
        .filter(*scope_conditions(ProductionRecord.municipality_id))
        .group_by(ProductionRecord.municipality_id, Municipality.name)
        .all()
    )

    by_barangay = (
        db.session.query(
            ProductionRecord.municipality_id,
            ProductionRecord.barangay_id,
            Barangay.name,
            func.sum(ProductionRecord.production_volume_mt).label("total_volume"),
            func.count(ProductionRecord.id).label("record_count"),
            func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed).label("total_area"),
            func.sum(ProductionRecord.registered_producers).label("total_registered"),
        )
        .join(Barangay, Barangay.id == ProductionRecord.barangay_id)
        .filter(ProductionRecord.status == "approved")
        .filter(
            ProductionRecord.municipality_id.in_(active_municipality_ids_subquery())
        )
        .filter(*scope_conditions(ProductionRecord.municipality_id))
        .group_by(ProductionRecord.municipality_id, ProductionRecord.barangay_id, Barangay.name)
        .all()
    )
    by_barangay_by_muni = {}
    for row in by_barangay:
        by_barangay_by_muni.setdefault(row.municipality_id, []).append({
            "barangay_id": row.barangay_id,
            "barangay": row.name,
            "total_volume_mt": float(row.total_volume or 0),
            "record_count": row.record_count,
            "total_area_sqm": float(row.total_area or 0),
            "total_registered_producers": int(row.total_registered or 0),
        })

    approved_producer_entries = (
        db.session.query(
            ProducerReport.municipality_id,
            ProducerReportEntry.barangay_id,
            ProducerReportEntry.sex,
            func.count(ProducerReportEntry.id).label("producer_count"),
        )
        .join(ProducerReportEntry, ProducerReportEntry.report_id == ProducerReport.id)
        .filter(ProducerReport.status == "approved")
        .filter(
            ProducerReport.municipality_id.in_(active_municipality_ids_subquery())
        )
        .filter(*scope_conditions(ProducerReport.municipality_id))
        .group_by(ProducerReport.municipality_id, ProducerReportEntry.barangay_id, ProducerReportEntry.sex)
        .all()
    )
    producer_totals_by_muni = {}
    producer_totals_by_barangay = {}
    for row in approved_producer_entries:
        count = int(row.producer_count or 0)
        muni_totals = producer_totals_by_muni.setdefault(row.municipality_id, {"registered": 0, "male": 0, "female": 0})
        barangay_totals = producer_totals_by_barangay.setdefault(
            (row.municipality_id, row.barangay_id), {"registered": 0},
        )
        muni_totals["registered"] += count
        barangay_totals["registered"] += count
        if row.sex == "Male":
            muni_totals["male"] += count
        elif row.sex == "Female":
            muni_totals["female"] += count

    for municipality_id, barangays in by_barangay_by_muni.items():
        for barangay_row in barangays:
            added = producer_totals_by_barangay.get((municipality_id, barangay_row["barangay_id"]))
            if added:
                barangay_row["total_registered_producers"] += added["registered"]

    existing_barangay_keys = {
        (municipality_id, barangay_row["barangay_id"])
        for municipality_id, barangays in by_barangay_by_muni.items()
        for barangay_row in barangays
    }
    for (municipality_id, barangay_id), totals in producer_totals_by_barangay.items():
        if (municipality_id, barangay_id) in existing_barangay_keys:
            continue
        barangay = db.session.get(Barangay, barangay_id)
        by_barangay_by_muni.setdefault(municipality_id, []).append({
            "barangay_id": barangay_id,
            "barangay": barangay.name if barangay else "Unknown",
            "total_volume_mt": 0.0,
            "record_count": 0,
            "total_area_sqm": 0.0,
            "total_registered_producers": totals["registered"],
        })

    approved_production = (
        ProductionRecord.query.filter_by(status="approved")
        .filter(ProductionRecord.municipality_id.in_(active_municipality_ids_subquery()))
        .filter(*scope_conditions(ProductionRecord.municipality_id))
    )
    total_volume = approved_production.with_entities(func.coalesce(func.sum(ProductionRecord.production_volume_mt), 0)).scalar() or 0
    total_area = approved_production.with_entities(func.coalesce(func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed), 0)).scalar() or 0
    total_records = approved_production.count()
    total_beds = approved_production.with_entities(func.coalesce(func.sum(ProductionRecord.num_salt_beds), 0)).scalar() or 0
    legacy_registered = approved_production.with_entities(func.coalesce(func.sum(ProductionRecord.registered_producers), 0)).scalar() or 0
    standalone_registered = sum(totals["registered"] for totals in producer_totals_by_muni.values())
    total_registered = int(legacy_registered or 0) + standalone_registered
    pending_validation_count = (
        ProductionRecord.query.filter_by(status="pending")
        .filter(ProductionRecord.municipality_id.in_(active_municipality_ids_subquery()))
        .filter(*scope_conditions(ProductionRecord.municipality_id))
        .count()
        + EnvironmentReport.query.filter_by(status="pending")
        .filter(EnvironmentReport.municipality_id.in_(active_municipality_ids_subquery()))
        .filter(*scope_conditions(EnvironmentReport.municipality_id))
        .count()
        + ProducerReport.query.filter_by(status="pending")
        .filter(ProducerReport.municipality_id.in_(active_municipality_ids_subquery()))
        .filter(*scope_conditions(ProducerReport.municipality_id))
        .count()
    )

    environment_by_muni = _environment_by_municipality(selected_municipality_id)

    municipality_stats = []
    for row in by_municipality:
        producer_totals = producer_totals_by_muni.get(row.municipality_id, {})
        municipality_stats.append({
            "municipality_id": row.municipality_id,
            "municipality_name": row.name,
            "total_volume_mt": float(row.total_volume or 0),
            "record_count": row.record_count,
            "total_area_sqm": float(row.total_area or 0),
            "total_salt_beds": int(row.total_beds or 0),
            "total_registered_producers": int(row.total_registered or 0) + producer_totals.get("registered", 0),
            "total_male_producers": int(row.total_male or 0) + producer_totals.get("male", 0),
            "total_female_producers": int(row.total_female or 0) + producer_totals.get("female", 0),
            "by_barangay": by_barangay_by_muni.get(row.municipality_id, []),
        })
    existing_municipality_ids = {row["municipality_id"] for row in municipality_stats}
    for municipality_id, producer_totals in producer_totals_by_muni.items():
        if municipality_id in existing_municipality_ids:
            continue
        municipality = db.session.get(Municipality, municipality_id)
        municipality_stats.append({
            "municipality_id": municipality_id,
            "municipality_name": municipality.name if municipality else "Unknown",
            "total_volume_mt": 0.0,
            "record_count": 0,
            "total_area_sqm": 0.0,
            "total_salt_beds": 0,
            "total_registered_producers": producer_totals["registered"],
            "total_male_producers": producer_totals["male"],
            "total_female_producers": producer_totals["female"],
            "by_barangay": by_barangay_by_muni.get(municipality_id, []),
        })

    municipality_names = {m.id: m.name for m in Municipality.query.filter_by(status="active").all()}
    master_list_by_municipality = _producer_master_list(
        selected_municipality_id, municipality_names
    )

    # --- Production method split over ALL approved records -----------------
    # WHY: the panel sits next to all-time tables, so it must use the same
    #      period instead of the public dashboard's rolling 12 months.
    production_methods_mt = _production_methods_by_municipality(
        selected_municipality_id, municipality_names
    )

    production_period = None
    production_includes_synthetic = False
    total_production_month_count = 0
    total_synthetic_month_count = 0
    if production_source == "municipality_production":
        monthly, error = _monthly_production_source(
            selected_municipality_id, municipality_stats, by_barangay_by_muni
        )
        if error:
            return error
        total_volume = monthly["total_volume"]
        total_production_month_count = monthly["total_production_month_count"]
        total_synthetic_month_count = monthly["total_synthetic_month_count"]
        production_period = monthly["production_period"]
        production_includes_synthetic = monthly["production_includes_synthetic"]

    return jsonify({
        "total_volume_mt": float(total_volume),
        "production_data_source": production_source,
        "production_period": production_period,
        "production_includes_synthetic": production_includes_synthetic,
        "production_month_count": total_production_month_count,
        "synthetic_month_count": total_synthetic_month_count,
        "total_area_sqm": float(total_area or 0),
        "record_count": total_records,
        "total_salt_beds": int(total_beds or 0),
        "total_registered_producers": int(total_registered or 0),
        "pending_validation_count": pending_validation_count,
        "by_municipality": municipality_stats,
        "master_list_by_municipality": master_list_by_municipality,
        "production_methods_mt": production_methods_mt,
        "environment_by_municipality": sorted(
            environment_by_muni.values(), key=lambda item: item["municipality_name"].lower(),
        ),
    })


@admin_api_bp.route("/data-quality", methods=["GET"])
@login_required
def data_quality():
    # WHAT: Serve the whole Data Quality payload in one response.
    # WHY: The page must show only what the database really contains, so every
    #      score, cell state and threshold is computed in the service and sent
    #      along - the browser never guesses a number of its own.
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    # WHY: "months" is the documented parameter ("all" = every month since data
    #      gathering started); "range" is still accepted because the shared API
    #      client sends that one.
    raw_months = request.args.get("months") or request.args.get("range") or 12
    if str(raw_months).strip().lower() == "all":
        range_months = "all"
    else:
        try:
            range_months = int(raw_months)
        except (TypeError, ValueError):
            range_months = 12
        if range_months not in DATA_QUALITY_RANGES:
            range_months = 12

    return jsonify(build_data_quality(range_months))


# National-level sector demand breakdown (reference data, MT). Not stored in the
# demand_benchmarks table (which holds annual supply/demand figures); served here
# as a labeled reference constant for the sector breakdown visualisation.
@admin_api_bp.route("/supply-demand", methods=["GET"])
@login_required
def supply_demand():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    provincial = DemandBenchmark.query.filter_by(geographic_scope="provincial").order_by(DemandBenchmark.year.desc()).first()
    national = DemandBenchmark.query.filter_by(geographic_scope="national").order_by(DemandBenchmark.year.desc()).first()

    latest_production_month = _last_month_with_data(
        None, source="production"
    )
    local_supply_period = None
    local_production_mt = None
    if latest_production_month:
        months = _month_block(latest_production_month, 12)
        _, monthly_totals = _production_month_totals(months)
        local_production_mt = round(sum(monthly_totals.values()), 3)
        start_year = int(months[0][:4])
        end_year = int(months[-1][:4])
        synthetic_months = {
            f"{row.production_year:04d}-{row.production_month:02d}"
            for row in MunicipalityMonthlyProduction.query.filter(
                MunicipalityMonthlyProduction.is_synthetic.is_(True),
                MunicipalityMonthlyProduction.production_year >= start_year,
                MunicipalityMonthlyProduction.production_year <= end_year,
            ).filter(
                MunicipalityMonthlyProduction.municipality_id.in_(
                    active_municipality_ids_subquery()
                )
            ).all()
        }
        local_supply_period = {
            "start": months[0],
            "end": months[-1],
            "includes_synthetic": any(month in synthetic_months for month in months),
        }

    pangasinan = {
        "year": provincial.year if provincial else datetime.utcnow().year,
        "demand_volume": float(provincial.demand_volume) if provincial else None,
        "local_production": local_production_mt,
        "local_supply_period": local_supply_period,
        "data_source": "municipality_production",
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


@admin_api_bp.route("/months", methods=["GET"])
@login_required
def admin_months():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403
    source = request.args.get("source", "approved_records")
    if source == "municipality_production":
        rows = (
            db.session.query(
                MunicipalityMonthlyProduction.production_year,
                MunicipalityMonthlyProduction.production_month,
            )
            .distinct()
            .filter(
                MunicipalityMonthlyProduction.municipality_id.in_(
                    active_municipality_ids_subquery()
                )
            )
            .order_by(
                MunicipalityMonthlyProduction.production_year,
                MunicipalityMonthlyProduction.production_month,
            )
            .all()
        )
        return jsonify({
            "months": [
                f"{row.production_year:04d}-{row.production_month:02d}"
                for row in rows
            ]
        })
    if source != "approved_records":
        return jsonify({
            "error": "source must be approved_records or municipality_production."
        }), 400
    rows = (
        db.session.query(
            func.to_char(ProductionRecord.record_date, "YYYY-MM").label("month"),
        )
        .filter(ProductionRecord.status == "approved")
        .filter(
            ProductionRecord.municipality_id.in_(active_municipality_ids_subquery())
        )
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


def _month_block(end_ym: str, count: int) -> list:
    """The `count` calendar months ending with (and including) `end_ym`."""
    out = []
    for _ in range(count):
        out.append(end_ym)
        end_ym = shift_month(end_ym, -1)
    out.reverse()
    return out


def _approved_month_totals(months, production_method=None):
    """Approved production grouped by month and municipality.

    Returns (per_municipality, province) where each is {month_ym: total_mt}.
    Months without any approved record are simply absent from the maps, so a
    missing month is never silently treated as zero production.
    """
    start, _ = month_bounds(months[0])
    _, end = month_bounds(months[-1])
    q = (
        db.session.query(
            ProductionRecord.municipality_id,
            func.to_char(ProductionRecord.record_date, "YYYY-MM").label("m"),
            func.sum(ProductionRecord.production_volume_mt).label("v"),
        )
        .filter(ProductionRecord.status == "approved")
        .filter(
            ProductionRecord.municipality_id.in_(active_municipality_ids_subquery())
        )
        .filter(ProductionRecord.record_date >= start)
        .filter(ProductionRecord.record_date <= end)
    )
    if production_method:
        q = q.filter(ProductionRecord.production_method == production_method)
    rows = (
        q.group_by(
            ProductionRecord.municipality_id,
            func.to_char(ProductionRecord.record_date, "YYYY-MM"),
        )
        .all()
    )
    per_muni = {}
    province = {}
    for r in rows:
        value = float(r.v or 0)
        per_muni.setdefault(r.municipality_id, {})[r.m] = value
        province[r.m] = province.get(r.m, 0.0) + value
    return per_muni, province


def _production_month_totals(months):
    """Municipality production data grouped by month and municipality."""
    requested = set(months)
    per_municipality = {}
    province = {}
    for row in (
        MunicipalityMonthlyProduction.query
        .filter(
            MunicipalityMonthlyProduction.municipality_id.in_(
                active_municipality_ids_subquery()
            )
        )
        .all()
    ):
        label = f"{row.production_year:04d}-{row.production_month:02d}"
        if label not in requested:
            continue
        value = float(row.production_kg) / 1000.0
        per_municipality.setdefault(row.municipality_id, {})[label] = value
        province[label] = province.get(label, 0.0) + value
    return per_municipality, province


@admin_api_bp.route("/trends", methods=["GET"])
@login_required
def trends():
    """Year-over-year comparison of approved records or municipality production data.

    Compares TWO COMPLETE 12-month calendar blocks: the 12 months ending on
    the latest month that has approved records ("current") and the 12 months
    before it ("previous"). Windows use calendar month boundaries, never
    365-day offsets, so both blocks always cover the same 12 calendar months.

    A municipality is reported as "incomplete" when any month in either block
    has no approved record; no percentage is returned for it, because the
    missing month cannot be assumed to be zero production. Every active
    municipality is always returned, so the caller can show the full active list.

    Query: month (optional 'YYYY-MM' anchor for the current block),
           production_method (optional solar|cooked|hybrid filter).
    """
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    source = request.args.get("source", "approved_records")
    if source == "municipality_estimates":
        source = "municipality_production"
    production_method = request.args.get("production_method") or None
    if source not in ("approved_records", "municipality_production"):
        return jsonify({"error": "source must be approved_records or municipality_production."}), 400
    if source == "municipality_production" and production_method:
        return jsonify({
            "error": "Production-method filters are unavailable for this production dataset."
        }), 400

    if source == "municipality_production":
        latest = MunicipalityMonthlyProduction.query.order_by(
            MunicipalityMonthlyProduction.production_year.desc(),
            MunicipalityMonthlyProduction.production_month.desc(),
        ).first()
        latest_month = (
            f"{latest.production_year:04d}-{latest.production_month:02d}"
            if latest
            else None
        )
    else:
        latest = (
            db.session.query(func.max(ProductionRecord.record_date))
            .filter(ProductionRecord.status == "approved")
            .scalar()
        )
        latest_month = (
            f"{latest.year:04d}-{latest.month:02d}" if latest else None
        )
    if latest_month is None:
        return jsonify({
            "trend": [],
            "municipalities": [],
            "period": None,
            "totals": None,
            "data_source": source,
        })

    anchor = request.args.get("month")
    if anchor:
        try:
            datetime.strptime(anchor, "%Y-%m")
        except (TypeError, ValueError):
            return jsonify({"error": "month must be in YYYY-MM format."}), 400
        anchor_ym = anchor
    else:
        anchor_ym = latest_month

    current_months = _month_block(anchor_ym, 12)
    previous_months = _month_block(shift_month(current_months[0], -1), 12)
    months = sorted(set(current_months + previous_months))
    if source == "municipality_production":
        per_muni, province = _production_month_totals(months)
    else:
        per_muni, province = _approved_month_totals(months, production_method)

    municipalities = []
    for m in Municipality.query.filter_by(status="active").order_by(Municipality.name).all():
        per = per_muni.get(m.id, {})
        current_mt = round(sum(per.get(lb, 0.0) for lb in current_months), 3)
        previous_mt = round(sum(per.get(lb, 0.0) for lb in previous_months), 3)
        missing_current = sum(1 for lb in current_months if lb not in per)
        missing_previous = sum(1 for lb in previous_months if lb not in per)
        complete = missing_current == 0 and missing_previous == 0
        change_pct = None
        if complete and previous_mt:
            change_pct = round(((current_mt - previous_mt) / previous_mt) * 100, 1)
        municipalities.append({
            "municipality_id": m.id,
            "name": m.name,
            "current": current_mt,
            "previous": previous_mt,
            "changePct": change_pct,
            "status": "complete" if complete else "incomplete",
            "missing_current_months": missing_current,
            "missing_previous_months": missing_previous,
        })

    current_total = round(sum(province.get(lb, 0.0) for lb in current_months), 3)
    previous_total = round(sum(province.get(lb, 0.0) for lb in previous_months), 3)
    totals = {
        "current": current_total,
        "previous": previous_total,
        "changePct": round(((current_total - previous_total) / previous_total) * 100, 1) if previous_total else None,
        "current_months": current_months[0],
        "previous_months": previous_months[0],
    }

    trend = [
        {"month": lb, "total": round(province[lb], 3) if lb in province else None}
        for lb in current_months
    ]

    return jsonify({
        "data_source": source,
        "trend": trend,
        "municipalities": municipalities,
        "totals": totals,
        "period": {
            "start": current_months[0],
            "end": current_months[-1],
            "previous_start": previous_months[0],
            "previous_end": previous_months[-1],
        },
    })