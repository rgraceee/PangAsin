# WHAT: Authentication endpoints (login, logout, current user info).
# WHY: Session-based login gamit ang flask_login; dito tinitingnan ang role ng user.
from flask import Blueprint, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from app.models.user import User
from app.constants import MAX_MONTHLY_VOLUME_MT
from app.extensions import db
from app.services.audit import log_action
from datetime import datetime

auth_api_bp = Blueprint("auth_api", __name__, url_prefix="/api/auth")


@auth_api_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password are required."}), 400

    user = User.query.filter_by(email=data["email"].strip().lower()).first()
    if not user or not user.check_password(data["password"]):
        log_action(
            "auth.login.failed",
            "user",
            getattr(user, "id", None),
            summary="Failed sign-in attempt.",
            actor_email=data["email"].strip().lower(),
            details={"email": data["email"].strip().lower()},
        )
        db.session.commit()
        return jsonify({"error": "Invalid email or password."}), 401

    if user.status != "active":
        log_action(
            "auth.login.blocked",
            "user",
            user.id,
            summary="Inactive account attempted to sign in.",
            actor=user,
            details={"email": user.email},
        )
        db.session.commit()
        return jsonify({"error": "Account is inactive. Contact administrator."}), 403

    login_user(user)
    user.last_login = datetime.utcnow()
    log_action(
        "auth.login",
        "user",
        user.id,
        summary=f"{user.email} signed in.",
        actor=user,
        details={"role": user.role},
    )
    db.session.commit()

    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "municipality_id": user.municipality_id,
        "municipality_name": user.municipality.name if user.municipality else None,
        "must_change_password": user.must_change_password,
        "max_monthly_volume_mt": MAX_MONTHLY_VOLUME_MT,
    })


@auth_api_bp.route("/change-password", methods=["POST"])
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password or not new_password:
        return jsonify({
            "error": "current_password and new_password are required."
        }), 400
    if not current_user.check_password(current_password):
        return jsonify({"error": "Current password is incorrect."}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters."}), 400
    if new_password == current_password:
        return jsonify({
            "error": "New password must be different from the current password."
        }), 400

    current_user.set_password(new_password)
    current_user.must_change_password = False
    log_action(
        "auth.password.change",
        "user",
        current_user.id,
        summary=f"{current_user.email} changed their password.",
    )
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not update the password. Please try again."}), 500

    return jsonify({"message": "Password updated successfully."})


@auth_api_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully."})


@auth_api_bp.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "municipality_id": current_user.municipality_id,
        "municipality_name": current_user.municipality.name if current_user.municipality else None,
        "must_change_password": current_user.must_change_password,
        "max_monthly_volume_mt": MAX_MONTHLY_VOLUME_MT,
    })
