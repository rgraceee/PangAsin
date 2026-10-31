# WHAT: Shared read helpers for the active municipality directory.
# WHY: Municipalities are managed in the database now, so every count, label,
#      map highlight and analytics scope must follow the same active list
#      instead of a hard-coded set of seven salt-producing areas.
from sqlalchemy import select

from app.labels import scope_all_label as _scope_all_label
from app.models.municipality import Municipality


def active_municipalities():
    """Every active municipality, ordered by name."""
    return Municipality.query.filter_by(status="active").order_by(Municipality.name).all()


def active_municipality_ids():
    return [municipality.id for municipality in active_municipalities()]


def active_municipality_ids_subquery():
    """Scalar subquery of active ids, for filtering other tables in one round trip."""
    return select(Municipality.id).where(Municipality.status == "active")


def active_municipality_count():
    return Municipality.query.filter_by(status="active").count()


def is_active_municipality(municipality_id):
    if municipality_id is None:
        return False
    return (
        Municipality.query.filter_by(id=municipality_id, status="active").first()
        is not None
    )


def scope_all_label(count=None):
    """Human label for the all-municipalities scope.

    WHAT: "All N municipalities", driven by the database instead of text that
          says seven.
    WHY: Adding or deactivating a municipality must update every label.
    """
    if count is None:
        count = active_municipality_count()
    if count <= 1:
        return "All municipalities"
    return _scope_all_label(count)


def normalized_name(name):
    """Normalized key for name-keyed lookups (insights, map matching)."""
    return " ".join(str(name or "").lower().split())
