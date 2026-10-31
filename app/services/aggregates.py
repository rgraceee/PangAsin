# WHAT: Shared monthly aggregation helper.
# WHY: Used by both forecast_service.py and report_service.py so both stay
#      in sync when the aggregation logic changes. No model imports beyond the
#      shared ProductionRecord model.
from datetime import date
from typing import Dict, List, Optional, Tuple

from app.extensions import db
from app.models.production_record import ProductionRecord
from app.models.municipality_production import MunicipalityMonthlyProduction
from app.services.municipalities import active_municipality_ids_subquery

# Reference epoch for computing real (non-compressed) month positions.
_EPOCH_YEAR = 2000
_EPOCH_MONTH = 1


def _grid_start_end(range_months: int, today: date) -> Tuple[date, date]:
    """Return (start, end) dates covering the last `range_months` months ending
    at the current month. `range_months` is one of 12, 24, or 36."""
    end = today
    # Count back `range_months` months from the first of this month.
    y, m = today.year, today.month
    total = y * 12 + (m - 1) - (range_months - 1)
    sy, sm = divmod(total, 12)
    sm += 1
    start = date(sy, sm, 1)
    return start, end


def _month_labels(start: date, end: date) -> List[str]:
    """Build 'YYYY-MM' labels for every month from start to end inclusive."""
    labels: List[str] = []
    y, m = start.year, start.month
    while (y < end.year) or (y == end.year and m <= end.month):
        labels.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return labels


def _reporting_grid(
    municipality_ids: List[int],
    municipality_names: Dict[int, str],
    range_months: int,
) -> Tuple[List[str], List[dict]]:
    """Compute the reporting completeness grid for the given municipalities.

    Groups months by year with a year header band above the month columns.
    Returns (grid_labels, reporting_grid) where reporting_grid entries include
    per-municipality summary: completeness_pct, missing_months,
    last_reported_month. Sorted by lowest completeness first so problems float
    to the top.

    WHAT: Which months each municipality had approved records, over the last
          N months (12/24/36).
    WHY: Gaps in reporting reduce forecast accuracy; admins need to see them.
    """
    today = date.today()
    grid_start, grid_end = _grid_start_end(range_months, today)
    grid_labels = _month_labels(grid_start, grid_end)

    reported_set = set()
    if municipality_ids:
        reported_rows = (
            ProductionRecord.query
            .filter(ProductionRecord.status == "approved")
            .filter(ProductionRecord.municipality_id.in_(municipality_ids))
            .filter(ProductionRecord.record_date >= grid_start)
            .filter(ProductionRecord.record_date <= grid_end)
            .with_entities(
                ProductionRecord.municipality_id,
                db.func.to_char(ProductionRecord.record_date, "YYYY-MM").label("month"),
            )
            .distinct()
            .all()
        )
        reported_set = {(r.municipality_id, r.month) for r in reported_rows}

    reporting_grid: List[dict] = []
    for muni_id in municipality_ids:
        muni_name = municipality_names.get(muni_id, "Unknown")
        months: List[dict] = []
        reported_count = 0
        last_reported = None
        for lb in grid_labels:
            is_reported = (muni_id, lb) in reported_set
            months.append({"month_label": lb, "reported": is_reported})
            if is_reported:
                reported_count += 1
                if last_reported is None or lb > last_reported:
                    last_reported = lb
        total = len(grid_labels)
        completeness_pct = round((reported_count / total) * 100, 1) if total else 0.0
        missing_months = total - reported_count
        reporting_grid.append({
            "municipality_id": muni_id,
            "municipality_name": muni_name,
            "months": months,
            "completeness_pct": completeness_pct,
            "missing_months": missing_months,
            "last_reported_month": last_reported,
        })

    # Sort by lowest completeness first so problems float to the top.
    reporting_grid.sort(key=lambda x: x["completeness_pct"])
    return grid_labels, reporting_grid


def _offset_for(y: int, m: int) -> int:
    return (y - _EPOCH_YEAR) * 12 + (m - _EPOCH_MONTH)


def _monthly_aggregates(
    municipality_id: Optional[int],
    start: date,
    end: date,
    source: str = "approved",
):
    """Return (labels, values, offsets) for the requested monthly data source.

    `offsets` are measured in whole months from a fixed epoch, so gaps in the
    record history are represented by larger offsets instead of a compressed
    0..n-1 index. This keeps slopes and spacing honest when months are missing.
    Only months with data are returned. Forecasting uses municipality production data;
    operational reporting can continue to request approved submissions.
    """
    if source in ("production", "estimate"):
        query = MunicipalityMonthlyProduction.query.filter(
            db.or_(
                MunicipalityMonthlyProduction.production_year > start.year,
                db.and_(
                    MunicipalityMonthlyProduction.production_year == start.year,
                    MunicipalityMonthlyProduction.production_month >= start.month,
                ),
            ),
            db.or_(
                MunicipalityMonthlyProduction.production_year < end.year,
                db.and_(
                    MunicipalityMonthlyProduction.production_year == end.year,
                    MunicipalityMonthlyProduction.production_month <= end.month,
                ),
            ),
        )
        if municipality_id is not None:
            query = query.filter(
                MunicipalityMonthlyProduction.municipality_id == municipality_id
            )
        # WHAT: Inactive municipalities are hidden from every aggregate.
        # WHY: Deactivation must remove their historical rows from analytics and
        #      forecasts without deleting the data.
        query = query.filter(
            MunicipalityMonthlyProduction.municipality_id.in_(
                active_municipality_ids_subquery()
            )
        )
        rows = query.order_by(
            MunicipalityMonthlyProduction.production_year,
            MunicipalityMonthlyProduction.production_month,
        ).all()
        labels = []
        values = []
        offsets = []
        for row in rows:
            labels.append(f"{row.production_year:04d}-{row.production_month:02d}")
            values.append(float(row.production_kg) / 1000.0)
            offsets.append(_offset_for(row.production_year, row.production_month))
        return labels, values, offsets

    if source != "approved":
        raise ValueError(f"Unsupported monthly aggregate source: {source}")

    q = (
        ProductionRecord.query
        .filter(ProductionRecord.status == "approved")
        .filter(ProductionRecord.record_date >= start)
        .filter(ProductionRecord.record_date <= end)
        .filter(
            ProductionRecord.municipality_id.in_(active_municipality_ids_subquery())
        )
    )
    if municipality_id is not None:
        q = q.filter(ProductionRecord.municipality_id == municipality_id)
    q = q.with_entities(
        db.func.date_trunc("month", ProductionRecord.record_date).label("month"),
        db.func.sum(ProductionRecord.production_volume_mt).label("volume"),
    ).group_by(db.text("1")).order_by(db.text("1"))
    rows = q.all()
    labels = []
    values = []
    offsets = []
    for r in rows:
        y = r.month.year
        m = r.month.month
        labels.append(f"{y:04d}-{m:02d}")
        values.append(float(r.volume or 0))
        offsets.append(_offset_for(y, m))
    return labels, values, offsets


def _reindex_complete(
    labels: List[str],
    values: List[float],
    offsets: List[int],
    start_ym: str,
    end_ym: str,
) -> Tuple[List[str], List[Optional[float]], List[int]]:
    """Rebuild a complete monthly index from `start_ym` to `end_ym` (inclusive).

    Missing months are represented as `None` (NaN) — never zeros — so models
    never treat an unreported month as zero production. Returns
    (complete_labels, complete_values, complete_offsets).
    """
    sy, sm = int(start_ym[:4]), int(start_ym[5:7])
    ey, em = int(end_ym[:4]), int(end_ym[5:7])

    # Map existing label -> value.
    by_label: Dict[str, float] = {}
    for lb, v in zip(labels, values):
        by_label[lb] = v

    complete_labels: List[str] = []
    complete_values: List[Optional[float]] = []
    complete_offsets: List[int] = []

    y, m = sy, sm
    while (y < ey) or (y == ey and m <= em):
        lb = f"{y:04d}-{m:02d}"
        complete_labels.append(lb)
        if lb in by_label:
            complete_values.append(by_label[lb])
            complete_offsets.append(_offset_for(y, m))
        else:
            complete_values.append(None)
            complete_offsets.append(_offset_for(y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return complete_labels, complete_values, complete_offsets


def _last_month_with_data(
    municipality_id: Optional[int],
    source: str = "approved",
) -> Optional[str]:
    """Return the latest month label for a source, or None when it has no data."""
    if source in ("production", "estimate"):
        query = MunicipalityMonthlyProduction.query
        if municipality_id is not None:
            query = query.filter(
                MunicipalityMonthlyProduction.municipality_id == municipality_id
            )
        query = query.filter(
            MunicipalityMonthlyProduction.municipality_id.in_(
                active_municipality_ids_subquery()
            )
        )
        row = query.order_by(
            MunicipalityMonthlyProduction.production_year.desc(),
            MunicipalityMonthlyProduction.production_month.desc(),
        ).first()
        if row is None:
            return None
        return f"{row.production_year:04d}-{row.production_month:02d}"

    if source != "approved":
        raise ValueError(f"Unsupported latest-month source: {source}")

    q = (
        ProductionRecord.query
        .filter(ProductionRecord.status == "approved")
        .filter(
            ProductionRecord.municipality_id.in_(active_municipality_ids_subquery())
        )
    )
    if municipality_id is not None:
        q = q.filter(ProductionRecord.municipality_id == municipality_id)
    row = (
        q.with_entities(db.func.max(ProductionRecord.record_date).label("max_date"))
        .first()
    )
    if not row or row.max_date is None:
        return None
    d = row.max_date
    return f"{d.year:04d}-{d.month:02d}"
