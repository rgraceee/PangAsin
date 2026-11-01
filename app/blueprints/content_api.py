# WHAT: Content, settings and announcement API for SuperAdmin governance.
# WHY: Public read for privacy/terms/faq_public; authenticated read for the
#      role's FAQ and about; SuperAdmin-only write for content, settings and
#      the announcement. Existing admin endpoints are untouched.
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from app.services.content_service import get_content, set_content, CONTENT_KEYS
from app.services.setting_service import get_all_settings, set_setting, SETTING_CODES
from app.services.announcement_service import get_active_announcement, set_announcement
from app.extensions import db

content_api_bp = Blueprint("content_api", __name__, url_prefix="/api")


def _require_superadmin():
    if current_user.role != "superadmin":
        return jsonify({"error": "SuperAdmin access required."}), 403
    return None


# ---------- Content ----------
@content_api_bp.route("/content/<key>", methods=["GET"])
def get_content_item(key):
    if key not in CONTENT_KEYS:
        return jsonify({"error": "Unknown content key."}), 404
    if key in ("faq_admin", "faq_encoder", "about"):
        # Authenticated only: role-specific FAQ and about.
        if not current_user.is_authenticated:
            return jsonify({"error": "Unauthorized"}), 401
        if key == "faq_admin" and current_user.role not in ("admin", "superadmin"):
            return jsonify({"error": "Forbidden."}), 403
        if key == "faq_encoder" and current_user.role not in ("encoder", "superadmin"):
            return jsonify({"error": "Forbidden."}), 403
    return jsonify(get_content(key)), 200


@content_api_bp.route("/content/<key>", methods=["PUT"])
@login_required
def put_content_item(key):
    err = _require_superadmin()
    if err:
        return err
    if key not in CONTENT_KEYS:
        return jsonify({"error": "Unknown content key."}), 404
    data = request.get_json(silent=True) or {}
    row, err = set_content(key, data, current_user)
    if err:
        return jsonify({"error": err}), 400
    db.session.commit()
    return jsonify(get_content(key)), 200


# ---------- Settings ----------
@content_api_bp.route("/settings", methods=["GET"])
@login_required
def list_settings():
    err = _require_superadmin()
    if err:
        return err
    return jsonify(get_all_settings()), 200


@content_api_bp.route("/settings/<key>", methods=["PUT"])
@login_required
def put_setting(key):
    err = _require_superadmin()
    if err:
        return err
    if key not in SETTING_CODES:
        return jsonify({"error": "Unknown setting key."}), 404
    data = request.get_json(silent=True) or {}
    value = data.get("value")
    row, err = set_setting(key, value, current_user)
    if err:
        return jsonify({"error": err}), 400
    db.session.commit()
    return jsonify({"key": key, "value": row.value, "type": row.type}), 200


# ---------- Announcement ----------
@content_api_bp.route("/announcement", methods=["GET"])
def get_announcement():
    announcement = get_active_announcement()
    return jsonify({"announcement": announcement}), 200


@content_api_bp.route("/announcement", methods=["PUT"])
@login_required
def put_announcement():
    err = _require_superadmin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    row, err = set_announcement(
        data.get("message", ""),
        data.get("level", "info"),
        data.get("active", False),
        data.get("starts_at"),
        data.get("ends_at"),
        current_user,
    )
    if err:
        return jsonify({"error": err}), 400
    db.session.commit()
    return jsonify(row.serialize()), 200
