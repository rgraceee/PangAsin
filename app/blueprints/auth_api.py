# WHAT: Authentication endpoints (login, logout, current user info).
# WHY: Session-based login gamit ang flask_login; dito tinitingnan ang role ng user.
import hashlib
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, session, current_app, render_template
from flask_login import login_user, logout_user, login_required, current_user
from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.constants import MAX_MONTHLY_VOLUME_MT
from app.extensions import db
from app.services.audit import log_action
from app.services.email import send_email

auth_api_bp = Blueprint("auth_api", __name__, url_prefix="/api/auth")

GENERIC_RESET_MESSAGE = (
    "If that email is registered, a reset link has been sent."
)


def _hash_reset_token(raw_token):
    # WHAT: SHA-256 hash ng high-entropy reset token.
    # WHY: Hindi password ito kaya hindi kailangan ang slow password hash;
    #      sapat na ang one-way hash para hindi ma-recover ang plain token.
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _reset_token_error(token, now=None):
    now = now or datetime.utcnow()
    if token is None:
        return {
            "code": "invalid_token",
            "error": "This reset link is invalid. Please request a new one.",
        }, 400
    if token.used_at is not None:
        return {
            "code": "used_token",
            "error": "This reset link has already been used. Please request a new one.",
        }, 400
    if token.is_expired(now):
        return {
            "code": "expired_token",
            "error": "This reset link has expired. Please request a new one.",
        }, 400
    if token.user is None:
        return {
            "code": "invalid_token",
            "error": "This reset link is invalid. Please request a new one.",
        }, 400
    if token.user.status != "active":
        return {
            "code": "inactive_account",
            "error": "This account is inactive. Please contact your administrator.",
        }, 403
    return None


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
    # WHAT: Itala ang account session version sa login session.
    # WHY: Kapag nag-reset ng password, tataas ang version at lahat ng lumang
    #      sessions ay awtomatikong mawawalan ng bisa.
    session["auth_version"] = user.session_version or 0
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


@auth_api_bp.route("/password-reset-request", methods=["POST"])
def password_reset_request():
    # WHAT: Generates a hashed, single-use token at nagpapadala ng reset email.
    # WHY: Email ang standard reset flow; ang generic response ay pumipigil sa
    #      account enumeration kahit hindi registered ang email.
    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()

    if not email or "@" not in email or len(email) > 150:
        return jsonify({"error": "Enter a valid email address."}), 400

    now = datetime.utcnow()
    user = User.query.filter_by(email=email).first()
    sendable_user = user if user and user.status == "active" else None

    if sendable_user is not None:
        # WHAT: Revoke older unused links bago gumawa ng bago.
        # WHY: Isang aktibong link lang sa isang pagkakataon; kapag na-click
        #      ang lumang email pagkatapos ng bagong request, invalid na ito.
        PasswordResetToken.query.filter_by(
            user_id=sendable_user.id, used_at=None
        ).update({"used_at": now}, synchronize_session=False)

        raw_token = secrets.token_urlsafe(32)
        expiry_minutes = current_app.config.get("PASSWORD_RESET_TOKEN_MINUTES", 30)
        token = PasswordResetToken(
            user_id=sendable_user.id,
            token_hash=_hash_reset_token(raw_token),
            expires_at=now + timedelta(minutes=expiry_minutes),
            created_at=now,
        )
        db.session.add(token)

    log_action(
        "auth.password.reset_request",
        "user",
        getattr(sendable_user, "id", None),
        summary="Password reset requested.",
        actor_email=email,
        details={"email": email},
    )

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not store password reset request.")
        return jsonify({"message": GENERIC_RESET_MESSAGE})

    if sendable_user is not None:
        try:
            frontend_url = current_app.config.get(
                "FRONTEND_URL", "http://localhost:5000"
            ).rstrip("/")
            reset_url = f"{frontend_url}/reset-password?token={raw_token}"
            expiry_minutes = current_app.config.get(
                "PASSWORD_RESET_TOKEN_MINUTES", 30
            )
            context = {
                "user_name": sendable_user.name,
                "reset_url": reset_url,
                "expiry_minutes": expiry_minutes,
            }
            html = render_template("emails/password_reset.html", **context)
            text = render_template("emails/password_reset.txt", **context)
            # WHAT: send_email never raises; it logs SMTP failures.
            # WHY: The public response must stay generic and must not crash.
            send_email(
                sendable_user.email,
                "Reset your PangAsin password",
                html,
                text,
            )
        except Exception:
            current_app.logger.exception("Could not prepare password reset email.")

    return jsonify({"message": GENERIC_RESET_MESSAGE})


@auth_api_bp.route("/password-reset/validate", methods=["GET"])
def validate_password_reset_token():
    # WHAT: Sinusuri ng reset page kung usable pa ang token bago magpakita ng form.
    # WHY: Malinaw agad sa user kung expired, used, o invalid ang link.
    raw_token = str(request.args.get("token") or "").strip()
    if not raw_token:
        return jsonify({
            "valid": False,
            "code": "missing_token",
            "error": "This reset link is missing its token. Please request a new one.",
        }), 400

    now = datetime.utcnow()
    token = PasswordResetToken.query.filter_by(
        token_hash=_hash_reset_token(raw_token)
    ).first()
    error = _reset_token_error(token, now)
    if error:
        payload, status = error
        return jsonify({"valid": False, **payload}), status

    return jsonify({
        "valid": True,
        "expires_at": token.expires_at.isoformat() + "Z",
    })


@auth_api_bp.route("/password-reset/confirm", methods=["POST"])
def confirm_password_reset():
    # WHAT: Single-use reset: palitan ang password, invalidate ang token at
    #       lahat ng existing sessions, tapos i-log sa audit trail.
    # WHY: Ito ang huling hakbang kung saan nagbabago ang credential.
    data = request.get_json(silent=True) or {}
    raw_token = str(data.get("token") or "").strip()
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not raw_token:
        return jsonify({
            "code": "missing_token",
            "error": "This reset link is missing its token. Please request a new one.",
        }), 400

    now = datetime.utcnow()
    # WHAT: I-lock ang token row habang nagpapatuloy ang reset.
    # WHY: Kung dalawang request ang sabay pumasok, isa lang ang makaka-reset;
    #      hindi dapat magamit ang token nang dalawang beses.
    token = (
        PasswordResetToken.query.filter_by(
            token_hash=_hash_reset_token(raw_token)
        )
        .with_for_update()
        .first()
    )
    error = _reset_token_error(token, now)
    if error:
        payload, status = error
        return jsonify(payload), status

    if len(new_password) < 6:
        return jsonify({
            "code": "weak_password",
            "error": "Password must be at least 6 characters.",
        }), 400
    if new_password != confirm_password:
        return jsonify({
            "code": "password_mismatch",
            "error": "The new password and confirmation do not match.",
        }), 400

    user = token.user
    user.set_password(new_password)
    user.must_change_password = False
    # WHAT: Increment account session version.
    # WHY: Mawawalan ng bisa ang lahat ng existing sessions ng account.
    user.session_version = (user.session_version or 0) + 1
    token.used_at = now
    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.id != token.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now}, synchronize_session=False)
    log_action(
        "auth.password.reset_complete",
        "user",
        user.id,
        summary=f"{user.email} completed a password reset.",
        details={"email": user.email},
    )

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not complete password reset.")
        return jsonify({
            "error": "Could not update the password. Please try again."
        }), 500

    if current_user.is_authenticated and current_user.id == user.id:
        logout_user()

    return jsonify({
        "message": "Password reset successfully. You can now sign in."
    })


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
