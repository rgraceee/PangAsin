# WHAT: SuperAdmin API endpoints — account management, force password reset,
#       force logout, unlock, audit log and login event listing.
# WHY: Isang malapit na papel (superadmin) ang makakagawa ng mga kritikal na
#      pagbabago sa account at monitoring ng lahat ng login at audit events.
#      Walang role ang makakahanap rito maliban sa superadmin.
from datetime import datetime, timedelta
from decimal import Decimal
from secrets import token_urlsafe

from flask import Blueprint, request, jsonify, current_app
from flask_login import current_user, login_required

from app.models.user import User
from app.models.login_events import LoginEvent
from app.models.audit_log import AuditLog
from app.models.production_record import ProductionRecord
from app.models.forecast import ForecastRun
from app.models.municipality import Municipality
from app.extensions import db
from app.services.audit import log_action
from app.services.setting_service import get_setting
from app.services.forecast_service import run_forecast_all_municipalities
from app.constants import APP_VERSION
from app.utils import is_not_admin
from sqlalchemy import or_, func, text

superadmin_api_bp = Blueprint("superadmin_api", __name__, url_prefix="/api/superadmin")


def _require_superadmin():
    # WHAT: Non-superadmin (admin, encoder, anon) gets 404, not 403,
    #       so superadmin routes are indistinguishable from missing routes.
    # WHY: Admin/encoder/anon must not learn that SuperAdmin endpoints exist.
    if current_user.role != "superadmin":
        return jsonify({"error": "Not found."}), 404
    return None


def _serialize_user(u):
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "municipality_id": u.municipality_id,
        "municipality_name": u.municipality.name if u.municipality else None,
        "status": u.status,
        "must_change_password": u.must_change_password,
        "failed_login_count": u.failed_login_count,
        "locked_until": u.locked_until.isoformat() + "Z" if u.locked_until else None,
        "last_login": u.last_login.isoformat() + "Z" if u.last_login else None,
        "created_at": u.created_at.isoformat() + "Z" if u.created_at else None,
    }


def _validate_municipality(municipality_id):
    from app.models.municipality import Municipality

    m = Municipality.query.get(municipality_id)
    if not m:
        return jsonify({"error": "Municipality not found."}), 404
    return None


@superadmin_api_bp.route("/users", methods=["GET"])
@login_required
def list_users():
    err = _require_superadmin()
    if err:
        return err

    role = request.args.get("role")
    status = request.args.get("status")
    municipality_id = request.args.get("municipality_id", type=int)
    q = request.args.get("q", "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 25, type=int)

    query = User.query
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)
    if municipality_id:
        query = query.filter(User.municipality_id == municipality_id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(User.name.ilike(like), User.email.ilike(like))
        )
    query = query.order_by(User.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    users = pagination.items
    return jsonify({
        "users": [_serialize_user(u) for u in users],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }), 200


@superadmin_api_bp.route("/users", methods=["POST"])
@login_required
def create_user():
    err = _require_superadmin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    role = data.get("role")
    municipality_id = data.get("municipality_id")

    if not name or not email or role not in ("admin", "encoder"):
        return jsonify({"error": "Name, email and role (admin/encoder) are required."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    if role == "encoder":
        err = _validate_municipality(municipality_id)
        if err:
            return err

    raw_token = None
    user = User(
        name=name,
        email=email,
        role=role,
        municipality_id=municipality_id if role == "encoder" else None,
        status="active",
        must_change_password=True,
    )
    raw_token = token_urlsafe(16)
    user.set_password(raw_token)
    db.session.add(user)
    db.session.commit()

    log_action(
        "superadmin.user.create",
        "user",
        user.id,
        actor=current_user,
        summary=f"{current_user.email} created {role} account for {name}.",
        details={
            "email": user.email,
            "role": role,
            "municipality_id": user.municipality_id,
            # WHAT: Never persist the one-time password.
            # WHY: Audit rows and logs are long-lived and readable by others.
        },
    )
    db.session.commit()

    return (
        jsonify(
            {
                "user": _serialize_user(user),
                "temporary_password": raw_token,
                "message": (
                    "Account created. Share the temporary password once — the "
                    "user must change it on first login."
                ),
            }
        ),
        201,
    )


@superadmin_api_bp.route("/users/<int:user_id>/deactivate", methods=["POST"])
@login_required
def deactivate_user(user_id):
    err = _require_superadmin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason or len(reason) < 10:
        return jsonify({"error": "Reason is required (at least 10 characters)."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404
    if user.id == current_user.id:
        return jsonify({"error": "You cannot deactivate your own account."}), 400
    if user.role == "superadmin":
        active_superadmins = User.query.filter_by(
            role="superadmin", status="active"
        ).count()
        if active_superadmins <= 1:
            return jsonify(
                {"error": "Cannot deactivate the last active SuperAdmin."}
            ), 400

    active_admins = User.query.filter(
        User.role.in_(("admin", "superadmin")), User.status == "active"
    ).count()
    if user.role == "admin" and active_admins <= 1:
        return jsonify(
            {"error": "Cannot deactivate the last active admin."}
        ), 400

    user.status = "inactive"
    db.session.add(user)
    db.session.commit()

    log_action(
        "superadmin.user.deactivate",
        "user",
        user.id,
        actor=current_user,
        summary=f"{current_user.email} deactivated {user.email}.",
        reason=reason,
        details={"email": user.email, "role": user.role},
    )
    db.session.commit()

    return jsonify({"message": f"{user.name} has been deactivated."})


@superadmin_api_bp.route("/users/<int:user_id>/reactivate", methods=["POST"])
@login_required
def reactivate_user(user_id):
    err = _require_superadmin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason or len(reason) < 10:
        return jsonify({"error": "Reason is required (at least 10 characters)."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    user.status = "active"
    db.session.add(user)
    db.session.commit()

    log_action(
        "superadmin.user.reactivate",
        "user",
        user.id,
        actor=current_user,
        summary=f"{current_user.email} reactivated {user.email}.",
        reason=reason,
        details={"email": user.email, "role": user.role},
    )
    db.session.commit()

    return jsonify({"message": f"{user.name} has been reactivated."})


@superadmin_api_bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@login_required
def reset_password(user_id):
    err = _require_superadmin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason or len(reason) < 10:
        return jsonify({"error": "Reason is required (at least 10 characters)."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404
    if user.id == current_user.id:
        return jsonify({"error": "You cannot reset your own password here."}), 400

    raw_token = token_urlsafe(16)
    user.set_password(raw_token)
    user.must_change_password = True
    user.session_version = (user.session_version or 0) + 1
    user.failed_login_count = 0
    user.locked_until = None
    db.session.add(user)
    db.session.commit()

    log_action(
        "superadmin.user.reset_password",
        "user",
        user.id,
        actor=current_user,
        summary=f"{current_user.email} reset password for {user.email}.",
        reason=reason,
        details={"email": user.email, "role": user.role},
    )
    db.session.commit()

    return jsonify(
        {
            "user": _serialize_user(user),
            "temporary_password": raw_token,
            "message": (
                "Password reset. The user must change it on next login."
            ),
        }
    )


@superadmin_api_bp.route("/users/<int:user_id>/municipality", methods=["POST"])
@login_required
def change_municipality(user_id):
    err = _require_superadmin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason or len(reason) < 10:
        return jsonify({"error": "Reason is required (at least 10 characters)."}), 400

    municipality_id = data.get("municipality_id")

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    if user.role == "encoder" and not municipality_id:
        return jsonify({"error": "Municipality is required for encoders."}), 400
    if municipality_id:
        err = _validate_municipality(municipality_id)
        if err:
            return err

    before = user.municipality_id
    user.municipality_id = municipality_id or None
    db.session.add(user)
    db.session.commit()

    log_action(
        "superadmin.user.change_municipality",
        "user",
        user.id,
        actor=current_user,
        summary=f"{current_user.email} changed municipality of {user.email}.",
        reason=reason,
        details={
            "email": user.email,
            "from": before,
            "to": user.municipality_id,
        },
    )
    db.session.commit()

    return jsonify({"user": _serialize_user(user)})


@superadmin_api_bp.route("/users/<int:user_id>/force-logout", methods=["POST"])
@login_required
def force_logout(user_id):
    err = _require_superadmin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason or len(reason) < 10:
        return jsonify({"error": "Reason is required (at least 10 characters)."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404
    if user.id == current_user.id:
        return jsonify({"error": "You cannot force-logout yourself."}), 400

    user.session_version = (user.session_version or 0) + 1
    db.session.add(user)
    db.session.commit()

    log_action(
        "superadmin.user.force_logout",
        "user",
        user.id,
        actor=current_user,
        summary=f"{current_user.email} forced logout of {user.email}.",
        reason=reason,
        details={"email": user.email, "role": user.role},
    )
    db.session.commit()

    return jsonify({"message": f"{user.name} has been logged out from all sessions."})


@superadmin_api_bp.route("/users/<int:user_id>/unlock", methods=["POST"])
@login_required
def unlock_user(user_id):
    err = _require_superadmin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason or len(reason) < 10:
        return jsonify({"error": "Reason is required (at least 10 characters)."}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    user.unlock()
    db.session.add(user)
    db.session.commit()

    log_action(
        "superadmin.user.unlock",
        "user",
        user.id,
        actor=current_user,
        summary=f"{current_user.email} unlocked {user.email}.",
        reason=reason,
        details={"email": user.email, "role": user.role},
    )
    db.session.commit()

    return jsonify({"message": f"{user.name}'s account has been unlocked."})


@superadmin_api_bp.route("/audit-log", methods=["GET"])
@login_required
def audit_log():
    err = _require_superadmin()
    if err:
        return err

    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, int(request.args.get("per_page", 50)))
    actor = request.args.get("actor")
    action = request.args.get("action")
    entity_type = request.args.get("entity_type")

    q = AuditLog.query
    if actor:
        q = q.filter(AuditLog.actor_email.ilike(f"%{actor}%"))
    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)

    q = q.order_by(AuditLog.created_at.desc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        {
            "entries": [e.serialize() for e in pagination.items],
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
            "total": pagination.total,
        }
    )


@superadmin_api_bp.route("/login-events", methods=["GET"])
@login_required
def login_events():
    err = _require_superadmin()
    if err:
        return err

    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, int(request.args.get("per_page", 50)))
    user_email = request.args.get("user_email")
    success = request.args.get("success")

    q = LoginEvent.query
    if user_email:
        q = q.filter(LoginEvent.email.ilike(f"%{user_email}%"))
    if success is not None:
        q = q.filter(LoginEvent.success == (success.lower() == "true"))

    q = q.order_by(LoginEvent.created_at.desc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        {
            "entries": [e.serialize() for e in pagination.items],
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages,
            "total": pagination.total,
        }
    )


@superadmin_api_bp.route("/export/records", methods=["GET"])
@login_required
def export_records():
    err = _require_superadmin()
    if err:
        return err
    import csv, io
    from datetime import datetime

    municipality_id = request.args.get("municipality_id", type=int)
    start = request.args.get("start")
    end = request.args.get("end")
    status = request.args.get("status")

    q = ProductionRecord.active()
    if municipality_id:
        q = q.filter(ProductionRecord.municipality_id == municipality_id)
    if start:
        q = q.filter(ProductionRecord.record_date >= start)
    if end:
        q = q.filter(ProductionRecord.record_date <= end)
    if status:
        q = q.filter(ProductionRecord.status == status)
    q = q.order_by(ProductionRecord.record_date.desc(), ProductionRecord.id.desc())

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "record_date", "municipality_id", "barangay_id",
        "production_volume_mt", "num_salt_beds", "production_method", "status",
        "submitted_by", "submitted_at", "reviewed_by", "reviewed_at",
        "deleted_at", "deleted_by",
    ])
    for r in q.all():
        writer.writerow([
            r.id, r.record_date, r.municipality_id, r.barangay_id,
            r.production_volume_mt, r.num_salt_beds, r.production_method, r.status,
            r.submitted_by, r.submitted_at.isoformat() + "Z" if r.submitted_at else None,
            r.reviewed_by, r.reviewed_at.isoformat() + "Z" if r.reviewed_at else None,
            r.deleted_at.isoformat() + "Z" if r.deleted_at else None,
            r.deleted_by,
        ])

    log_action(
        "superadmin.export.records",
        "export",
        None,
        actor=current_user,
        summary=f"{current_user.email} exported production records to CSV.",
    )
    db.session.commit()

    filename = f"pangasin-production-records-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv"
    return (
        buf.getvalue(),
        200,
        {
            "Content-Type": "text/csv",
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@superadmin_api_bp.route("/records/<int:record_id>/soft-delete", methods=["POST"])
@login_required
def soft_delete_record(record_id):
    err = _require_superadmin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if len(reason) < 10:
        return jsonify({"error": "Reason must be at least 10 characters."}), 400

    record = ProductionRecord.query.get(record_id)
    if not record:
        return jsonify({"error": "Record not found."}), 404
    if record.deleted_at:
        return jsonify({"error": "Record is already deleted."}), 400

    before = {
        "production_volume_mt": str(record.production_volume_mt),
        "status": record.status,
    }
    record.soft_delete(current_user.id)

    log_action(
        "superadmin.record.soft_delete",
        "production_record",
        record.id,
        actor=current_user,
        summary=f"{current_user.email} soft-deleted production record {record.id}.",
        details={"before": before, "reason": reason},
    )
    db.session.commit()
    return jsonify({"message": "Record soft-deleted."})


@superadmin_api_bp.route("/records/<int:record_id>/restore", methods=["POST"])
@login_required
def restore_record(record_id):
    err = _require_superadmin()
    if err:
        return err
    record = ProductionRecord.query.get(record_id)
    if not record:
        return jsonify({"error": "Record not found."}), 404
    if not record.deleted_at:
        return jsonify({"error": "Record is not deleted."}), 400

    record.restore()
    log_action(
        "superadmin.record.restore",
        "production_record",
        record.id,
        actor=current_user,
        summary=f"{current_user.email} restored production record {record.id}.",
    )
    db.session.commit()
    return jsonify({"message": "Record restored."})


@superadmin_api_bp.route("/records/<int:record_id>/edit", methods=["PATCH"])
@login_required
def edit_record(record_id):
    err = _require_superadmin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()
    if len(reason) < 10:
        return jsonify({"error": "Reason must be at least 10 characters."}), 400

    record = ProductionRecord.query.get(record_id)
    if not record:
        return jsonify({"error": "Record not found."}), 404
    if record.deleted_at:
        return jsonify({"error": "Cannot edit a deleted record."}), 400
    if record.status != "approved":
        return jsonify({"error": "Only approved records can be edited here."}), 409

    # Fields allowed for SuperAdmin edit of approved records.
    allowed = {
        "production_volume_mt", "num_salt_beds", "area_per_salt_bed",
        "registered_producers", "male_producers", "female_producers",
        "producers_18_30", "producers_31_40", "producers_41_50",
        "producers_51_60", "producers_61_plus", "production_method",
    }
    before = {}
    changed = False
    for field in allowed:
        if field in data:
            new_val = data[field]
            old_val = getattr(record, field)
            # Normalize numeric comparison.
            if isinstance(old_val, (int, float)) and new_val is not None:
                try:
                    new_val = type(old_val)(new_val)
                except (TypeError, ValueError):
                    return jsonify({"error": f"Invalid value for {field}."}), 400
            before[field] = float(old_val) if isinstance(old_val, Decimal) else old_val
            if new_val != old_val:
                setattr(record, field, new_val)
                changed = True

    if not changed:
        return jsonify({"error": "No fields changed."}), 400

    # Recompute registered_producers from male + female if those changed.
    if "male_producers" in data or "female_producers" in data:
        record.registered_producers = (record.male_producers or 0) + (record.female_producers or 0)

    db.session.add(record)

    after = {f: (float(getattr(record, f)) if isinstance(getattr(record, f), Decimal) else getattr(record, f)) for f in allowed}
    log_action(
        "superadmin.record.edit",
        "production_record",
        record.id,
        actor=current_user,
        summary=f"{current_user.email} edited approved production record {record.id}.",
        reason=reason,
        old_value=before,
        new_value=after,
        details={"reason": reason},
    )
    db.session.commit()

    return jsonify({
        "message": "Record updated.",
        "record": {
            "id": record.id,
            "production_volume_mt": str(record.production_volume_mt),
            "num_salt_beds": record.num_salt_beds,
            "area_per_salt_bed": str(record.area_per_salt_bed) if record.area_per_salt_bed is not None else None,
            "registered_producers": record.registered_producers,
            "male_producers": record.male_producers,
            "female_producers": record.female_producers,
            "production_method": record.production_method,
        },
    })


@superadmin_api_bp.route("/records/<int:record_id>/permanent-delete", methods=["DELETE"])
@login_required
def permanent_delete_record(record_id):
    err = _require_superadmin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    confirm_text = (data.get("confirm_text") or "").strip()
    if confirm_text != "DELETE":
        return jsonify({"error": 'Type "DELETE" to confirm permanent deletion.'}), 400

    record = ProductionRecord.query.get(record_id)
    if not record:
        return jsonify({"error": "Record not found."}), 404
    if not record.deleted_at:
        return jsonify({"error": "Only soft-deleted records can be permanently deleted."}), 400

    log_action(
        "superadmin.record.permanent_delete",
        "production_record",
        record.id,
        actor=current_user,
        summary=f"{current_user.email} permanently deleted production record {record.id}.",
        details={"before": {
            "production_volume_mt": str(record.production_volume_mt),
            "status": record.status,
            "municipality_id": record.municipality_id,
            "barangay_id": record.barangay_id,
            "record_date": str(record.record_date),
        }},
    )
    record.permanent_delete()
    db.session.commit()

    return jsonify({"message": "Record permanently deleted."})


# ---------------------------------------------------------------------------
# CSV export helpers — explicit column allowlists, no secrets, injection-safe.
# ---------------------------------------------------------------------------

_CSV_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")


def _csv_safe(value):
    """Guard against CSV injection: prefix cells starting with dangerous chars."""
    if value is None:
        return ""
    s = str(value)
    if s and s[0] in _CSV_DANGEROUS_PREFIXES:
        return "'" + s
    return s


def _csv_response(rows, header, filename):
    import csv, io
    from datetime import datetime

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        writer.writerow([_csv_safe(c) for c in row])

    log_action(
        "superadmin.export.csv",
        "export",
        None,
        actor=current_user,
        summary=f"{current_user.email} exported {filename} to CSV.",
    )
    db.session.commit()

    return (
        buf.getvalue(),
        200,
        {
            "Content-Type": "text/csv",
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@superadmin_api_bp.route("/export/csv/salt-farmers", methods=["GET"])
@login_required
def export_salt_farmers():
    err = _require_superadmin()
    if err:
        return err
    from app.models.producer import Producer
    from app.models.barangay import Barangay

    municipality_id = request.args.get("municipality_id", type=int)
    q = Producer.query.join(Barangay, Barangay.id == Producer.barangay_id, isouter=True)
    if municipality_id:
        q = q.filter(Barangay.municipality_id == municipality_id)
    q = q.order_by(Barangay.municipality_id, Producer.name)
    rows = [
        [
            p.id,
            p.name,
            p.age or "",
            p.sex or "",
            p.address or "",
            p.barangay_id or "",
            p.barangay.municipality_id if p.barangay else None,
        ]
        for p in q.all()
    ]
    return _csv_response(
        rows,
        ["id", "name", "age", "sex", "address", "barangay_id", "municipality_id"],
        f"pangasin-salt-farmers-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv",
    )


@superadmin_api_bp.route("/export/csv/audit-log", methods=["GET"])
@login_required
def export_audit_log():
    err = _require_superadmin()
    if err:
        return err
    from datetime import datetime

    q = AuditLog.query.order_by(AuditLog.created_at.desc())
    rows = [
        [
            a.id,
            a.actor_email or "",
            a.action or "",
            a.entity_type or "",
            a.entity_id or "",
            a.summary or "",
            a.reason or "",
            a.ip_address or "",
            a.created_at.isoformat() + "Z" if a.created_at else "",
        ]
        for a in q.all()
    ]
    return _csv_response(
        rows,
        ["id", "actor_email", "action", "entity_type", "entity_id", "summary", "reason", "ip_address", "created_at"],
        f"pangasin-audit-log-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv",
    )


@superadmin_api_bp.route("/export/csv/login-history", methods=["GET"])
@login_required
def export_login_history():
    err = _require_superadmin()
    if err:
        return err
    from datetime import datetime

    q = LoginEvent.query.order_by(LoginEvent.created_at.desc())
    rows = [
        [
            e.id,
            e.email or "",
            e.success,
            e.ip or "",
            e.created_at.isoformat() + "Z" if e.created_at else "",
        ]
        for e in q.all()
    ]
    return _csv_response(
        rows,
        ["id", "email", "success", "ip", "created_at"],
        f"pangasin-login-history-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv",
    )


@superadmin_api_bp.route("/export/backup", methods=["GET"])
@login_required
def export_backup():
    err = _require_superadmin()
    if err:
        return err
    from datetime import datetime
    import io, os, tempfile, shutil

    db_uri = str(db.engine.url)
    filename_base = f"pangasin-backup-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"

    if "sqlite" in db_uri:
        # WHAT: Consistent SQLite copy via the backup API.
        # WHY: Never a raw file copy of a live DB file.
        src = db_uri.replace("sqlite:///", "", 1)
        fd, dst = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            src_conn = db.engine.connect()
            dst_conn = __import__("sqlite3").connect(dst)
            with dst_conn:
                src_conn.connection.backup(dst_conn)
            dst_conn.close()
            src_conn.close()
            log_action(
                "superadmin.export.backup",
                "backup",
                None,
                actor=current_user,
                summary=f"{current_user.email} downloaded SQLite database backup.",
            )
            db.session.commit()
            return (
                open(dst, "rb").read(),
                200,
                {
                    "Content-Type": "application/x-sqlite3",
                    "Content-Disposition": f'attachment; filename="{filename_base}.db"',
                    "Cache-Control": "no-store",
                },
            )
        finally:
            try:
                os.unlink(dst)
            except OSError:
                pass
    elif "postgresql" in db_uri:
        # WHAT: PostgreSQL logical backup via pg_dump, with a SQLAlchemy
        #       logical-dump fallback when pg_dump is not installed.
        # WHY: Consistent dump without locking the live database. pg_dump may
        #      not be present in every deployment, so a SQLAlchemy-based
        #       logical backup keeps the feature functional.
        import subprocess
        import subprocess

        fd, dst = tempfile.mkstemp(suffix=".sql")
        os.close(fd)
        try:
            env = dict(os.environ)
            pg_dump = current_app.config.get("PG_DUMP_PATH") or shutil.which("pg_dump")

            if pg_dump:
                result = subprocess.run(
                    [pg_dump, db_uri, "-f", dst],
                    capture_output=True,
                    text=True,
                    env=env,
                )
                if result.returncode != 0:
                    return jsonify({"error": "Database backup failed.", "detail": result.stderr[:500]}), 500
                log_action(
                    "superadmin.export.backup",
                    "backup",
                    None,
                    actor=current_user,
                    summary=f"{current_user.email} downloaded PostgreSQL database backup.",
                )
                db.session.commit()
                return (
                    open(dst, "rb").read(),
                    200,
                    {
                        "Content-Type": "application/sql",
                        "Content-Disposition": f'attachment; filename="{filename_base}.sql"',
                        "Cache-Control": "no-store",
                    },
                )

            # pg_dump is unavailable — fall back to a SQLAlchemy logical backup.
            from sqlalchemy.schema import CreateTable
            import app.models  # noqa: F401  ensure all models registered

            buf = io.StringIO()
            buf.write("-- PangAsin database logical backup\n")
            buf.write(f"-- Generated: {datetime.utcnow().isoformat()}Z\n")
            buf.write(f"-- Database: {db_uri.split('@')[-1] if '@' in db_uri else db_uri}\n")
            buf.write("--\n\n")

            # Reflect all tables via SQLAlchemy metadata.
            metadata = db.Model.metadata
            for table_name, table in sorted(metadata.tables.items()):
                buf.write(f"-- Table: {table_name}\n")
                buf.write(str(CreateTable(table).compile(db.engine)) + ";\n\n")

                cols = [c.name for c in table.columns]
                rows = db.session.execute(table.select()).mappings().all()
                for row in rows:
                    values = []
                    for c in cols:
                        v = row[c]
                        if v is None:
                            values.append("NULL")
                        elif isinstance(v, str):
                            values.append("'" + str(v).replace("'", "''") + "'")
                        elif isinstance(v, bytes):
                            values.append("'" + v.decode("utf-8", errors="replace").replace("'", "''") + "'")
                        elif isinstance(v, datetime):
                            values.append("'" + v.isoformat() + "Z'")
                        elif isinstance(v, bool):
                            values.append("true" if v else "false")
                        elif isinstance(v, (int, float, Decimal)):
                            values.append(str(v))
                        else:
                            values.append("'" + str(v).replace("'", "''") + "'")
                    buf.write(
                        f"INSERT INTO {table_name} ({', '.join(cols)}) "
                        f"VALUES ({', '.join(values)});\n"
                    )
                buf.write("\n")

            sql = buf.getvalue()
            log_action(
                "superadmin.export.backup",
                "backup",
                None,
                actor=current_user,
                summary=f"{current_user.email} downloaded PostgreSQL database backup (logical dump).",
            )
            db.session.commit()
            return (
                sql,
                200,
                {
                    "Content-Type": "application/sql",
                    "Content-Disposition": f'attachment; filename="{filename_base}.sql"',
                    "Cache-Control": "no-store",
                },
            )
        finally:
            try:
                os.unlink(dst)
            except OSError:
                pass
    else:
        return jsonify({"error": "Database backup not supported for this database type."}), 400


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@superadmin_api_bp.route("/health", methods=["GET"])
@login_required
def health():
    err = _require_superadmin()
    if err:
        return err

    now = datetime.utcnow()

    # Last forecast run (province-wide).
    last_run = (
        ForecastRun.query.filter(ForecastRun.municipality_id.is_(None))
        .order_by(ForecastRun.created_at.desc())
        .first()
    )
    last_forecast_run = last_run.created_at.isoformat() + "Z" if last_run else None

    # Last approved production record update.
    last_approved = (
        ProductionRecord.active()
        .filter_by(status="approved")
        .order_by(ProductionRecord.updated_at.desc())
        .first()
    )
    last_approved_update = last_approved.updated_at.isoformat() + "Z" if last_approved else None

    # Pending validations count.
    pending_validations = (
        ProductionRecord.active()
        .filter_by(status="pending")
        .count()
    )

    # User count by role.
    user_counts = (
        db.session.query(User.role, func.count(User.id))
        .group_by(User.role)
        .all()
    )
    users_by_role = {role: count for role, count in user_counts}

    # Failed logins last 24h.
    since_24h = now - timedelta(hours=24)
    failed_logins_24h = (
        LoginEvent.query
        .filter_by(success=False)
        .filter(LoginEvent.created_at >= since_24h)
        .count()
    )

    # DB type + size.
    db_uri = str(db.engine.url)
    if "sqlite" in db_uri:
        db_type = "SQLite"
        db_path = db_uri.replace("sqlite:///", "", 1)
        try:
            import os
            db_size_bytes = os.path.getsize(db_path)
            db_size = f"{db_size_bytes / 1024 / 1024:.2f} MB"
        except OSError:
            db_size = "unknown"
    elif "postgresql" in db_uri:
        db_type = "PostgreSQL"
        row = db.session.execute(
            text("SELECT pg_size_pretty(pg_database_size(current_database()))")
        ).scalar()
        db_size = row or "unknown"
    else:
        db_type = db_uri.split("://")[0]
        db_size = "unknown"

    db.session.commit()

    return jsonify({
        "app_version": APP_VERSION,
        "last_forecast_run": last_forecast_run,
        "last_approved_update": last_approved_update,
        "pending_validations": pending_validations,
        "users_by_role": users_by_role,
        "failed_logins_24h": failed_logins_24h,
        "db_type": db_type,
        "db_size": db_size,
    })


# ---------------------------------------------------------------------------
# Run forecast now (all municipalities)
# ---------------------------------------------------------------------------

_forecast_running = False


@superadmin_api_bp.route("/forecast/run", methods=["POST"])
@login_required
def run_forecast_now():
    global _forecast_running
    err = _require_superadmin()
    if err:
        return err
    if _forecast_running:
        return jsonify({"error": "A forecast run is already in progress."}), 409

    _forecast_running = True
    try:
        horizon = int(get_setting("forecast_horizon", 12))
        if horizon < 1 or horizon > 36:
            horizon = 12

        run_obj = run_forecast_all_municipalities(horizon)

        log_action(
            "superadmin.forecast.run",
            "forecast_run",
            run_obj.id,
            actor=current_user,
            summary=f"{current_user.email} ran a forecast for all municipalities (horizon={horizon} months).",
            details={"horizon": horizon, "run_id": run_obj.id},
        )
        db.session.commit()

        return jsonify({
            "message": "Forecast run completed.",
            "run_id": run_obj.id,
            "algorithm": run_obj.algorithm,
            "projected_total": str(run_obj.projected_total) if run_obj.projected_total is not None else None,
        }), 201
    except Exception as exc:
        current_app.logger.exception("Forecast run failed.")
        return jsonify({"error": f"Forecast run failed: {str(exc)}"}), 500
    finally:
        _forecast_running = False


# ---------------------------------------------------------------------------
# SMTP (read-only display + test)
# ---------------------------------------------------------------------------

@superadmin_api_bp.route("/smtp", methods=["GET"])
@login_required
def smtp_config():
    err = _require_superadmin()
    if err:
        return err
    # WHAT: Read-only SMTP config from env. Never expose MAIL_PASSWORD.
    # WHY: SuperAdmin can see that SMTP is configured but not the secret.
    return jsonify({
        "mail_server": current_app.config.get("MAIL_SERVER", ""),
        "mail_port": current_app.config.get("MAIL_PORT", 587),
        "mail_use_tls": bool(current_app.config.get("MAIL_USE_TLS", True)),
        "mail_use_ssl": bool(current_app.config.get("MAIL_USE_SSL", False)),
        "mail_username": current_app.config.get("MAIL_USERNAME", ""),
        "mail_default_sender": current_app.config.get("MAIL_DEFAULT_SENDER", ""),
        "smtp_configured": bool(current_app.config.get("MAIL_USERNAME") and current_app.config.get("MAIL_PASSWORD")),
    }), 200


@superadmin_api_bp.route("/smtp/test", methods=["POST"])
@login_required
def smtp_test():
    err = _require_superadmin()
    if err:
        return err
    if not current_app.config.get("MAIL_USERNAME") or not current_app.config.get("MAIL_PASSWORD"):
        return jsonify({"error": "SMTP is not configured (MAIL_USERNAME / MAIL_PASSWORD missing)."}), 400
    try:
        from app.services.email import send_email
        ok = send_email(
            current_user.email,
            "PangAsin SMTP Test",
            "<p>This is a test email from the PangAsin system. SMTP is working.</p>",
            "This is a test email from the PangAsin system. SMTP is working.",
        )
        if not ok:
            return jsonify({"error": "SMTP test email could not be sent. Check server logs."}), 500
        log_action(
            "superadmin.smtp.test",
            "smtp",
            None,
            actor=current_user,
            summary=f"{current_user.email} sent an SMTP test email.",
        )
        db.session.commit()
        return jsonify({"message": "Test email sent successfully."}), 200
    except Exception as exc:
        current_app.logger.exception("SMTP test failed.")
        return jsonify({"error": f"SMTP test failed: {str(exc)}"}), 500
