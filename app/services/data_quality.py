# WHAT: The Data Quality service — one place that computes everything the admin
#       Data Quality page shows.
# WHY: Reporting completeness and cell states are computed here with grouped
#      queries, so the browser only displays values from the database.
from datetime import date, datetime

from sqlalchemy import func

from app.extensions import db
from app.models.municipality import Municipality
from app.models.production_record import ProductionRecord
from app.models.environment_report import EnvironmentReport
from app.models.producer_report import ProducerReport

# WHAT: The month data gathering started, so no month before this is "expected".
# WHY: The ASIN Center only started collecting records in January 2023; earlier
#      months must never be counted as missing reports.
DATA_START = date(2023, 1, 1)

# WHAT: The month windows the admin may look at.
# WHY: The page offers exactly 6 and 12 months; anything else falls back to
#      the 12-month default so an unknown window cannot widen the report.
DATA_QUALITY_RANGES = (6, 12)

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

    `count` is the number of months back from the end month (6, 12).
    `count=None` means the whole history: every month from DATA_START up to
    the end month. The window never
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


def _empty_payload(months: list, current_month: str, selected_year: int) -> dict:
    return {
        "months": months,
        "available_years": list(range(DATA_START.year, date.today().year + 1)),
        "selected_year": selected_year,
        "current_month": current_month,
        "expected_months": 0,
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


def _month_status_counts(muni_ids):
    # WHAT: Count approved and pending records per municipality and month.
    # WHY: One grouped query replaces a per-cell lookup.
    month_expr = func.to_char(ProductionRecord.record_date, "YYYY-MM")
    rows = (
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
    for muni_id, month, status, count in rows:
        if status == "approved":
            approved_by[(muni_id, month)] = approved_by.get((muni_id, month), 0) + count
        else:
            pending_by[(muni_id, month)] = pending_by.get((muni_id, month), 0) + count
    return approved_by, pending_by


def _field_counts(muni_ids):
    # WHAT: Count non-NULL required fields per municipality (approved rows only).
    # WHY: func.count(column) counts non-NULL values, so a filled 0 still counts.
    rows = (
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
    return rows, {row.municipality_id: row for row in rows}


def _pending_counts(muni_ids):
    # WHAT: Count pending records and the oldest submission per municipality.
    # WHY: Drives the review backlog KPI and the per-municipality pending count.
    rows = (
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
    return {row.municipality_id: row for row in rows}


def _month_states(municipality_id, months, current_month, approved_by, pending_by):
    # WHAT: Classify every month in the window for one municipality.
    # WHY: "pending" must stay distinct from a silent "missing" month.
    cells = {}
    for month in months:
        approved = approved_by.get((municipality_id, month), 0)
        pending = pending_by.get((municipality_id, month), 0)
        if approved > 0:
            cells[month] = STATE_REPORTED
        elif month == current_month:
            cells[month] = STATE_PENDING if pending > 0 else STATE_CURRENT
        elif pending > 0:
            cells[month] = STATE_PENDING
        else:
            cells[month] = STATE_MISSING
    return cells


def _municipality_quality(
    municipality,
    months,
    current_month,
    expected_months,
    approved_by,
    pending_by,
    field_by_muni,
    pending_by_muni,
):
    # WHAT: Build one municipality's Data Quality row.
    # WHY: Reporting, fields and pending backlog must share the
    #      same window and the same grouped query results.
    cells = _month_states(
        municipality.id, months, current_month, approved_by, pending_by
    )

    reported_months = sum(
        1 for month in expected_months if cells[month] == STATE_REPORTED
    )
    reporting_pct = (
        round(100.0 * reported_months / len(expected_months), 1)
        if expected_months
        else 0.0
    )

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

    pending_row = pending_by_muni.get(municipality.id)

    return {
        "id": municipality.id,
        "name": municipality.name,
        "cells": cells,
        "reporting_pct": reporting_pct,
        "field_pct": field_pct,
        "last_reported": last_reported,
        "pending_count": int(pending_row.pending_count) if pending_row else 0,
        "oldest_pending_at": (
            pending_row.oldest_submitted.isoformat() if pending_row and pending_row.oldest_submitted else None
        ),
        "reported_months": reported_months,
        "expected_months": len(expected_months),
        "approved_records": approved_rows,
        "fields": fields,
    }


def _province_field_summary(field_rows):
    # WHAT: Province-wide completeness per required field.
    # WHY: The admin needs one aggregate row per field, not per municipality.
    total_approved = sum(int(row.approved_rows) for row in field_rows)
    province_fields = []
    for key, label in REQUIRED_FIELDS:
        present = sum(int(getattr(row, key) or 0) for row in field_rows)
        province_fields.append({
            "key": key,
            "label": label,
            "pct": round(100.0 * present / total_approved, 1) if total_approved else 0.0,
        })
    return province_fields, total_approved


def build_data_quality(range_months=12, year=None) -> dict:
    """Build the whole Data Quality payload for the admin page.

    `range_months` is 6 or 12 for a look-back window, or "all"/None for
    the whole history since data gathering started. The window ends in `year`.
    """
    today = date.today()
    selected_year = today.year if year is None else int(year)
    if selected_year < DATA_START.year or selected_year > today.year:
        selected_year = today.year
    window_end = date(selected_year, today.month if selected_year == today.year else 12, 1)
    current_month = _month_key(today)
    count = None if range_months is None or str(range_months).lower() == "all" else int(range_months)
    months = _month_window(window_end, count)
    # Keep the whole selected window in the denominator so the displayed
    # completion count matches the chosen 6- or 12-month period.
    expected_months = months

    municipalities = (
        Municipality.query.filter_by(status="active").order_by(Municipality.name).all()
    )
    if not municipalities:
        return _empty_payload(months, current_month, selected_year)

    muni_ids = [m.id for m in municipalities]

    approved_by, pending_by = _month_status_counts(muni_ids)
    field_rows, field_by_muni = _field_counts(muni_ids)
    pending_by_muni = _pending_counts(muni_ids)

    results = [
        _municipality_quality(
            municipality,
            months,
            current_month,
            expected_months,
            approved_by,
            pending_by,
            field_by_muni,
            pending_by_muni,
        )
        for municipality in municipalities
    ]

    # --- Province-wide totals, summed from the same grouped rows ---
    province_fields, _total_approved = _province_field_summary(field_rows)
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

    behind = [row for row in results if row["reporting_pct"] < 100]
    reviewable = [row for row in behind if row["pending_count"] > 0]
    pending_total = (
        ProductionRecord.active().filter_by(status="pending").count()
        + EnvironmentReport.query.filter_by(status="pending").count()
        + ProducerReport.query.filter_by(status="pending").count()
    )
    oldest_pending = min(
        (row["oldest_pending_at"] for row in results if row["oldest_pending_at"]),
        default=None,
    )
    oldest_pending_days = 0
    if oldest_pending:
        oldest_pending_days = max(0, (today - datetime.fromisoformat(oldest_pending).date()).days)

    results.sort(key=lambda row: (row["reporting_pct"], row["name"].lower()))

    return {
        "months": months,
        "available_years": list(range(DATA_START.year, today.year + 1)),
        "selected_year": selected_year,
        "current_month": current_month,
        "expected_months": len(expected_months),
        "kpis": {
            "field_pct": field_pct,
            "reporting_pct": reporting_pct,
            "behind_count": len(behind),
            "municipality_count": len(municipalities),
            "pending_total": pending_total,
            "oldest_pending_days": oldest_pending_days,
            "review_clearable_count": len(reviewable),
            "total_submitted_count": (
                ProductionRecord.active().count()
                + EnvironmentReport.query.count()
                + ProducerReport.query.count()
            ),
        },
        "fields": province_fields,
        "municipalities": results,
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }
