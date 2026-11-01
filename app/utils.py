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
    # WHY: SuperAdmin sits above Admin and must reach every admin endpoint;
    #      encoders and anonymous callers are still rejected.
    return current_user.role not in ("admin", "superadmin")