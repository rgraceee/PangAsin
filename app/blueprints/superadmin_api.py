# WHAT: SuperAdmin API endpoints — account management, force password reset,
#       force logout, unlock, audit log and login event listing.
# WHY: Isang malapit na papel (superadmin) ang makakagawa ng mga kritikal na
#      pagbabago sa account at monitoring ng lahat ng login at audit events.
#      Walang role ang makakahanap rito maliban sa superadmin.
from datetime import datetime
from secrets import token_urlsafe

from flask import Blueprint, request, jsonify
from flask_login import current_user, login_required

from app.models.user import User
from app.models.login_events import LoginEvent
from app.models.audit_log import AuditLog
from app.models.production_record import ProductionRecord
from app.extensions import db
from app.services.audit import log_action
from app.utils import is_not_admin
from sqlalchemy import or_

superadmin_api_bp = Blueprint("superadmin_api", __name__, url_prefix="/api/superadmin")


def _require_superadmin():
    # WHAT: Pareho ang is_not_admin kaya idagdag natin ang check para sa role.
    # WHY: Hindi pwedeng ma-access ng admin ang superadmin endpoints.
    if current_user.role != "superadmin":
        return jsonify({"error": "SuperAdmin access required."}), 403
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

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    data = request.get_json(silent=True) or {}
    municipality_id = data.get("municipality_id")

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
