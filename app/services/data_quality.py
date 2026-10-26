# WHAT: The Data Quality service — one place that computes everything the admin
#       Data Quality page shows.
# WHY: The page must only display what the database really contains, so the
#      scoring, the thresholds and the cell states are computed here with a few
#      grouped queries (no per-row queries in a loop) and shipped to the UI, so
#      the browser never re-computes a score of its own.
from datetime import date, datetime

from sqlalchemy import func

from app.extensions import db
from app.models.municipality import Municipality
from app.models.production_record import ProductionRecord

# WHAT: The month data gathering started, so no month before this is "expected".
# WHY: The ASIN Center only started collecting records in January 2023; earlier
#      months must never be counted as missing reports.
DATA_START = date(2023, 1, 1)

# WHAT: The month windows the admin may look at.
# WHY: The page only offers 12/24/36 months; anything else falls back to 36.
DATA_QUALITY_RANGES = (12, 24, 36)

# WHAT: The thresholds and weights used to score a municipality.
# WHY: Defined once and shipped with every response, so the UI can never
#      hardcode a different number than the one used to score.
THRESHOLDS = {
    "ok": 85,
    "watch": 70,
    "stale_months": 3,
    "w_reporting": 0.6,
    "w_fields": 0.4,
}

# WHAT: The nine required fields of a production record, with plain-language labels.
# WHY: The admin is not a data engineer — "Area per salt bed" is clearer than
#      "area_per_salt_bed", and the browser must not invent its own labels.
REQUIRED_FIELDS = (
    ("production_volume_mt", "Salt production (Metric Tons (MT))"),
    ("num_salt_beds", "Number of salt beds"),
    ("area_per_salt_bed", "Area per salt bed"),
    ("registered_producers", "Total salt farmers"),
    ("male_producers", "Male salt farmers"),
    ("female_producers", "Female salt farmers"),
    ("record_date", "Date of record"),
    ("production_method", "Production method"),
    ("barangay_id", "Barangay"),
)

# WHAT: The cell states a municipality can be in for one month.
# WHY: "pending" is kept apart from "missing" — a month the encoder submitted
#      but the admin has not reviewed yet is not the same as a silent month.
STATE_REPORTED = "reported"
STATE_CURRENT = "current"
STATE_PENDING = "pending"
STATE_MISSING = "missing"


def _month_key(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def _month_window(end: date, count) -> list:
    """Return the "YYYY-MM" keys of the window, oldest first.

    `count` is the number of months back from the current month (12, 24, 36).
    `count=None` means the whole history: every month from DATA_START up to
    the current month. The window always ends on the current month and never
    starts before DATA_START.
    """
    if count is None:
        start = DATA_START
    else:
        total = end.year * 12 + (end.month - 1) - (count - 1)
        year, month = divmod(total, 12)
        month += 1
        start = date(year, month, 1)
        if start < DATA_START:
            start = DATA_START

    months = []
    cursor = start
    while (cursor.year, cursor.month) <= (end.year, end.month):
        months.append(_month_key(cursor))
        cursor = date(cursor.year + (cursor.month // 12), (cursor.month % 12) + 1, 1)
    return months


def _status_for(score: float, behind_months: int) -> str:
    """Return the worse of the score-based and the staleness-based status."""
    ok_at = THRESHOLDS["ok"]
    watch_at = THRESHOLDS["watch"]
    stale_at = THRESHOLDS["stale_months"]
    if score < watch_at or behind_months >= 2 * stale_at:
        return "critical"
    if score < ok_at or behind_months >= stale_at:
        return "watch"
    return "ok"


def _empty_payload(months: list, current_month: str) -> dict:
    return {
        "months": months,
        "current_month": current_month,
        "expected_months": 0,
        "thresholds": THRESHOLDS,
        "kpis": {
            "field_pct": 0.0,
            "reporting_pct": 0.0,
            "behind_count": 0,
            "municipality_count": 0,
            "pending_total": 0,
            "oldest_pending_days": 0,
            "review_clearable_count": 0,
        },
        "fields": [
            {"key": key, "label": label, "pct": 0.0} for key, label in REQUIRED_FIELDS
        ],
        "municipalities": [],
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }


def build_data_quality(range_months=36) -> dict:
    """Build the whole Data Quality payload for the admin page.

    `range_months` is 12, 24 or 36 for a look-back window, or "all"/None for
    the whole history since data gathering started.
    """
    today = date.today()
    current_month = _month_key(today)
    count = None if range_months is None or str(range_months).lower() == "all" else int(range_months)
    months = _month_window(today, count)
    # WHY: The current month is still in progress, so it is never "expected".
    expected_months = [m for m in months if m < current_month]

    municipalities = (
        Municipality.query.filter_by(status="active").order_by(Municipality.name).all()
    )
    if not municipalities:
        return _empty_payload(months, current_month)

    muni_ids = [m.id for m in municipalities]

    # --- Query 1: how many records per municipality, per month, per status ---
    month_expr = func.to_char(ProductionRecord.record_date, "YYYY-MM")
    month_rows = (
        db.session.query(
            ProductionRecord.municipality_id,
            month_expr.label("month"),
            ProductionRecord.status,
            func.count().label("n"),
        )
        .filter(ProductionRecord.status.in_(("approved", "pending")))
        .filter(ProductionRecord.municipality_id.in_(muni_ids))
        .group_by(ProductionRecord.municipality_id, month_expr, ProductionRecord.status)
        .all()
    )
    approved_by = {}
    pending_by = {}
    for muni_id, month, status, count in month_rows:
        if status == "approved":
            approved_by[(muni_id, month)] = approved_by.get((muni_id, month), 0) + count
        else:
            pending_by[(muni_id, month)] = pending_by.get((muni_id, month), 0) + count

    # --- Query 2: required-field counts per municipality (approved rows only) ---
    # WHY: func.count(column) counts non-NULL values only, so a filled 0 still
    #      counts as filled while an empty cell does not.
    field_rows = (
        db.session.query(
            ProductionRecord.municipality_id,
            func.count().label("approved_rows"),
            *[
                func.count(getattr(ProductionRecord, key)).label(key)
                for key, _label in REQUIRED_FIELDS
            ],
        )
        .filter(ProductionRecord.status == "approved")
        .filter(ProductionRecord.municipality_id.in_(muni_ids))
        .group_by(ProductionRecord.municipality_id)
        .all()
    )
    field_by_muni = {row.municipality_id: row for row in field_rows}

    # --- Query 3: how many records are still waiting, and how long ---
    pending_rows = (
        db.session.query(
            ProductionRecord.municipality_id,
            func.count().label("pending_count"),
            func.min(ProductionRecord.submitted_at).label("oldest_submitted"),
        )
        .filter(ProductionRecord.status == "pending")
        .filter(ProductionRecord.municipality_id.in_(muni_ids))
        .group_by(ProductionRecord.municipality_id)
        .all()
    )
    pending_by_muni = {row.municipality_id: row for row in pending_rows}

    w_reporting = THRESHOLDS["w_reporting"]
    w_fields = THRESHOLDS["w_fields"]
    results = []

    for municipality in municipalities:
        cells = {}
        for month in months:
            approved = approved_by.get((municipality.id, month), 0)
            pending = pending_by.get((municipality.id, month), 0)
            if approved > 0:
                cells[month] = STATE_REPORTED
            elif month == current_month:
                cells[month] = STATE_PENDING if pending > 0 else STATE_CURRENT
            elif pending > 0:
                cells[month] = STATE_PENDING
            else:
                cells[month] = STATE_MISSING

        reported_months = sum(1 for month in expected_months if cells[month] == STATE_REPORTED)
        reporting_pct = (
            round(100.0 * reported_months / len(expected_months), 1) if expected_months else 0.0
        )

        behind_months = 0
        for month in reversed(expected_months):
            if cells[month] == STATE_REPORTED:
                break
            behind_months += 1

        last_reported = None
        for month in months:
            if cells[month] == STATE_REPORTED:
                last_reported = month

        field_row = field_by_muni.get(municipality.id)
        approved_rows = int(field_row.approved_rows) if field_row else 0
        fields = {}
        for key, _label in REQUIRED_FIELDS:
            present = int(getattr(field_row, key) or 0) if field_row else 0
            fields[key] = round(100.0 * present / approved_rows, 1) if approved_rows else 0.0
        field_pct = round(sum(fields.values()) / len(REQUIRED_FIELDS), 1)

        score = round(w_reporting * reporting_pct + w_fields * field_pct, 1)
        pending_row = pending_by_muni.get(municipality.id)

        results.append({
            "id": municipality.id,
            "name": municipality.name,
            "cells": cells,
            "reporting_pct": reporting_pct,
            "field_pct": field_pct,
            "score": score,
            "behind_months": behind_months,
            "last_reported": last_reported,
            "pending_count": int(pending_row.pending_count) if pending_row else 0,
            "oldest_pending_at": (
                pending_row.oldest_submitted.isoformat() if pending_row and pending_row.oldest_submitted else None
            ),
            "status": _status_for(score, behind_months),
            "reported_months": reported_months,
            "expected_months": len(expected_months),
            "approved_records": approved_rows,
            "fields": fields,
        })

    # --- Province-wide totals, summed from the same grouped rows ---
    total_approved = sum(int(row.approved_rows) for row in field_rows)
    province_fields = []
    for key, label in REQUIRED_FIELDS:
        present = sum(int(getattr(row, key) or 0) for row in field_rows)
        province_fields.append({
            "key": key,
            "label": label,
            "pct": round(100.0 * present / total_approved, 1) if total_approved else 0.0,
        })
    field_pct = round(
        sum(item["pct"] for item in province_fields) / len(province_fields), 1
    ) if province_fields else 0.0

    total_expected_cells = len(municipalities) * len(expected_months)
    total_reported_cells = sum(
        1 for row in results for month in expected_months if row["cells"][month] == STATE_REPORTED
    )
    reporting_pct = (
        round(100.0 * total_reported_cells / total_expected_cells, 1)
        if total_expected_cells else 0.0
    )

    behind = [row for row in results if row["status"] != "ok"]
    reviewable = [row for row in behind if row["pending_count"] > 0]
    pending_total = sum(row["pending_count"] for row in results)
    oldest_pending = min(
        (row["oldest_pending_at"] for row in results if row["oldest_pending_at"]),
        default=None,
    )
    oldest_pending_days = 0
    if oldest_pending:
        oldest_pending_days = max(0, (today - datetime.fromisoformat(oldest_pending).date()).days)

    results.sort(key=lambda row: (row["score"], row["name"].lower()))

    return {
        "months": months,
        "current_month": current_month,
        "expected_months": len(expected_months),
        "thresholds": THRESHOLDS,
        "kpis": {
            "field_pct": field_pct,
            "reporting_pct": reporting_pct,
            "behind_count": len(behind),
            "municipality_count": len(municipalities),
            "pending_total": pending_total,
            "oldest_pending_days": oldest_pending_days,
            "review_clearable_count": len(reviewable),
        },
        "fields": province_fields,
        "municipalities": results,
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }
