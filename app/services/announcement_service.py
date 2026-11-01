# WHAT: Slim dismissible announcement banner shown on public, admin and encoder
#       layouts. Nothing renders when no announcement is active.
# WHY: Lets SuperAdmin broadcast one message across all roles from one place.
from app.extensions import db
from app.models.announcement import Announcement
from app.services.audit import log_action
from flask_login import current_user
from datetime import datetime
from sqlalchemy import or_


def get_active_announcement():
    """Return the currently active announcement, or None.

    Respects starts_at/ends_at window. Never raises.
    """
    try:
        now = datetime.utcnow()
        q = Announcement.query.filter(Announcement.active.is_(True))
        q = q.filter(
            db.or_(
                Announcement.starts_at.is_(None),
                Announcement.starts_at <= now,
            )
        )
        q = q.filter(
            db.or_(
                Announcement.ends_at.is_(None),
                Announcement.ends_at >= now,
            )
        )
        row = q.order_by(Announcement.updated_at.desc()).first()
        return row.serialize() if row else None
    except Exception:
        return None


def set_announcement(message, level, active, starts_at, ends_at, actor):
    """Create/update the single announcement row. Writes an audit row."""
    level = level or "info"
    if level not in ("info", "warning"):
        level = "info"

    row = Announcement.query.first()
    if not row:
        row = Announcement()
        db.session.add(row)
    before = row.serialize()
    row.message = message or ""
    row.level = level
    row.active = bool(active)
    row.starts_at = starts_at
    row.ends_at = ends_at
    row.updated_at = datetime.utcnow()

    log_action(
        "superadmin.announcement.update",
        "announcement",
        row.id,
        actor=current_user,
        summary=f"{current_user.email if current_user.is_authenticated else actor} updated announcement.",
        details={"before": before, "after": row.serialize()},
    )
    return row, None
