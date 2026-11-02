# WHAT: Content, settings and announcement API for SuperAdmin governance.
# WHY: Public read for privacy/terms/faq_public; authenticated read for the
#      role's FAQ and about; SuperAdmin-only write for content, settings and
#      the announcement. Existing admin endpoints are untouched.
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from app.services.content_service import get_content, set_content, reset_content, CONTENT_KEYS
from app.services.setting_service import get_all_settings, set_setting, SETTING_CODES
from app.services.announcement_service import get_active_announcement, set_announcement
from app.services.audit import log_action
from app.extensions import db
from app.models.help_faq import HelpFaq
from datetime import datetime

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


@content_api_bp.route("/content/<key>/reset", methods=["POST"])
@login_required
def reset_content_item(key):
    err = _require_superadmin()
    if err:
        return err
    if key not in CONTENT_KEYS:
        return jsonify({"error": "Unknown content key."}), 404
    row, err = reset_content(key, current_user)
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


# ---------- Help Center FAQ ----------
def _faq_error(message):
    return jsonify({"error": message}), 400


@content_api_bp.route("/help-faqs", methods=["GET"])
def list_help_faqs():
    public = request.args.get("public") == "1"
    q = HelpFaq.query
    if public:
        q = q.filter(HelpFaq.active.is_(True))
    q = q.order_by(HelpFaq.category, HelpFaq.sort_order, HelpFaq.id)
    return jsonify({"faqs": [f.serialize() for f in q.all()]}), 200


@content_api_bp.route("/help-faqs", methods=["POST"])
@login_required
def create_help_faq():
    err = _require_superadmin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    answer = (data.get("answer") or "").strip()
    category = (data.get("category") or "General").strip() or "General"
    if not question or not answer:
        return _faq_error("Question and answer are required.")
    row = HelpFaq(question=question, answer=answer, category=category,
                  sort_order=int(data.get("sort_order") or 0), active=bool(data.get("active", True)))
    db.session.add(row)
    db.session.flush()
    log_action(
        "superadmin.help_faq.create",
        "help_faq",
        row.id,
        actor=current_user,
        summary=f"{current_user.email} created FAQ #{row.id}.",
        details={"before": None, "after": row.serialize()},
    )
    db.session.commit()
    return jsonify(row.serialize()), 201


@content_api_bp.route("/help-faqs/<int:faq_id>", methods=["PUT"])
@login_required
def update_help_faq(faq_id):
    err = _require_superadmin()
    if err:
        return err
    row = HelpFaq.query.get(faq_id)
    if not row:
        return jsonify({"error": "FAQ not found."}), 404
    data = request.get_json(silent=True) or {}
    before = row.serialize()
    if "question" in data:
        q = (data.get("question") or "").strip()
        if not q:
            return _faq_error("Question is required.")
        row.question = q
    if "answer" in data:
        a = (data.get("answer") or "").strip()
        if not a:
            return _faq_error("Answer is required.")
        row.answer = a
    if "category" in data:
        row.category = (data.get("category") or "General").strip() or "General"
    if "sort_order" in data:
        try:
            row.sort_order = int(data.get("sort_order"))
        except (TypeError, ValueError):
            return _faq_error("sort_order must be an integer.")
    if "active" in data:
        row.active = bool(data.get("active"))
    row.updated_at = datetime.utcnow()
    log_action(
        "superadmin.help_faq.update",
        "help_faq",
        row.id,
        actor=current_user,
        summary=f"{current_user.email} updated FAQ #{row.id}.",
        details={"before": before, "after": row.serialize()},
    )
    db.session.commit()
    return jsonify(row.serialize()), 200


@content_api_bp.route("/help-faqs/<int:faq_id>", methods=["DELETE"])
@login_required
def delete_help_faq(faq_id):
    err = _require_superadmin()
    if err:
        return err
    row = HelpFaq.query.get(faq_id)
    if not row:
        return jsonify({"error": "FAQ not found."}), 404
    before = row.serialize()
    db.session.delete(row)
    log_action(
        "superadmin.help_faq.delete",
        "help_faq",
        faq_id,
        actor=current_user,
        summary=f"{current_user.email} deleted FAQ #{faq_id}.",
        details={"before": before, "after": None},
    )
    db.session.commit()
    return jsonify({"id": faq_id, "deleted": True}), 200


@content_api_bp.route("/help-faqs/reorder", methods=["PUT"])
@login_required
def reorder_help_faqs():
    err = _require_superadmin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    items = data.get("items")
    if not isinstance(items, list):
        return _faq_error("items must be a list of {id, sort_order}.")
    for item in items:
        fid = item.get("id")
        so = item.get("sort_order")
        if fid is None or so is None:
            return _faq_error("Each item needs id and sort_order.")
        try:
            so = int(so)
        except (TypeError, ValueError):
            return _faq_error("sort_order must be an integer.")
        row = HelpFaq.query.get(fid)
        if not row:
            return _faq_error(f"FAQ #{fid} not found.")
        row.sort_order = so
        row.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"reordered": len(items)}), 200
