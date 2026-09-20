# WHAT: Shared helper functions reused across the API blueprints.
# WHY: Avoid copy-pasting the same tiny helpers in every blueprint.

from datetime import datetime

from flask_login import current_user


def _parse_date(date_str):
    # WHAT: Convert a "YYYY-MM-DD" string into a date object.
    # WHY: Every blueprint validates user-supplied dates the same way; returns
    #      None for empty input and raises ValueError for bad formats.
    if not date_str:
        return None
    return datetime.strptime(str(date_str), "%Y-%m-%d").date()


def _admin_only():
    # WHAT: True when the current user is not an admin.
    # WHY: Admin routes call this at the top to reject non-admin access.
    return current_user.role != "admin"