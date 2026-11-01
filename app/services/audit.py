# WHAT: Small helper for writing audit rows inside the caller's transaction.
# WHY: Audit entries must commit or roll back together with the change they
#      describe, so this module never commits on its own.
import logging

from flask import has_request_context, request
from flask_login import current_user

from app.extensions import db
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def _request_ip():
    if not has_request_context():
        return None
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return (request.remote_addr or "")[:64] or None


def log_action(
    action,
    entity_type,
    entity_id=None,
    summary=None,
    details=None,
    old_value=None,
    new_value=None,
    reason=None,
    *,
    actor=None,
    actor_email=None,
    user_agent=None,
):
    """Queue an audit row on the current session.

    ``actor`` defaults to the logged-in user when a request is active. For
    unauthenticated events (failed logins) pass ``actor_email`` explicitly.
    """
    if actor is None and has_request_context() and current_user.is_authenticated:
        actor = current_user

    email_value = actor_email or getattr(actor, "email", None)
    entry = AuditLog(
        actor_id=getattr(actor, "id", None),
        actor_email=(email_value or "")[:150] or None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=(summary or "")[:255] or None,
        details=details or {},
        old_value=old_value or {},
        new_value=new_value or {},
        reason=reason,
        ip_address=_request_ip(),
        user_agent=(user_agent or request.headers.get("User-Agent", "")[:255] if has_request_context() else None) or None,
    )
    db.session.add(entry)
    return entry


def safe_log_action(
    action,
    entity_type,
    entity_id=None,
    summary=None,
    details=None,
    old_value=None,
    new_value=None,
    reason=None,
    *,
    actor=None,
    actor_email=None,
    user_agent=None,
):
    """Like log_action, but never raises.

    Used for auth events where a failed audit write must not break login.
    The error is logged server-side and the caller continues.
    """
    try:
        return log_action(
            action,
            entity_type,
            entity_id=entity_id,
            summary=summary,
            details=details,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            actor=actor,
            actor_email=actor_email,
            user_agent=user_agent,
        )
    except Exception:
        logger.exception("Audit write failed for action=%s entity_type=%s entity_id=%s", action, entity_type, entity_id)
        return None
