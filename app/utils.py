# WHAT: Shared helper functions reused across the API blueprints.
# WHY: Avoid copy-pasting the same tiny helpers in every blueprint.

from datetime import datetime

from flask_login import current_user


def parse_iso_date(date_str):
    # WHAT: Convert a "YYYY-MM-DD" string into a date object.
    # WHY: Every blueprint validates user-supplied dates the same way; returns
    #      None for empty input and raises ValueError for bad formats.
    if not date_str:
        return None
    return datetime.strptime(str(date_str), "%Y-%m-%d").date()


def is_not_admin():
    # WHAT: True when the current user is neither an admin nor a superadmin.
    # WHY: SuperAdmin can reach readonly admin pages (dashboard, forecast,
    #      data quality) but is blocked from admin-write/management routes
    #      via is_not_admin_only() where needed.
    return current_user.role not in ("admin", "superadmin")


def is_not_admin_only():
    # WHAT: True when the current user is not strictly an admin (blocks
    #       superadmin too). Used on admin-write/management routes that
    #       SuperAdmin must not reach.
    # WHY: Keeps admin work (validation, reports, municipalities, users)
    #      walled off from SuperAdmin, server-side, not just in the UI.
    return current_user.role != "admin"