# WHAT: Small helper for writing audit rows inside the caller's transaction.
# WHY: Audit entries must commit or roll back together with the change they
#      describe, so this module never commits on its own.
from flask import has_request_context, request
from flask_login import current_user

from app.extensions import db
from app.models.audit_log import AuditLog


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
    *,
    actor=None,
    actor_email=None,
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
        ip_address=_request_ip(),
    )
    db.session.add(entry)
    return entry
