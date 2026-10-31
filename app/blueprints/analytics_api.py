# WHAT: Read-only admin analytics endpoints (descriptive + predictive).
# WHY: Central place for all analytics queries; approved records only. Each
#      endpoint has a docstring stating what it measures and its unit. Old
#      fields are kept as aliases with a "# DEPRECATED alias" comment; only
#      new fields are added, so responses stay backward compatible.
from flask import Blueprint, request, jsonify
from flask_login import login_required
from app.extensions import db
from app.models.production_record import ProductionRecord
from app.models.municipality_production import MunicipalityMonthlyProduction
from app.models.forecast import ForecastRun
from app.models.municipality import Municipality
from app.models.demand_benchmark import DemandBenchmark
from app.services.forecast_service import (
    PRODUCTION_DATA_SOURCE,
    run_forecast,
    run_forecast_all_municipalities,
)
from app.services.aggregates import (
    _monthly_aggregates,
    _last_month_with_data,
    _reporting_grid,
)
from app.utils import _admin_only, _parse_date
from app.services.municipalities import (
    active_municipality_ids_subquery,
    is_active_municipality,
    scope_all_label,
)
from datetime import date, timedelta
from app.services.date_math import add_months, month_start_offset
from sqlalchemy import func, case

analytics_api_bp = Blueprint("analytics_api", __name__, url_prefix="/api/admin/analytics")

MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

# A year is "complete" when at least 10 months have approved records.
_COMPLETE_YEAR_MONTHS = 10


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _query_records(municipality_id, start=None, end=None, production_method=None):
    q = (
        ProductionRecord.query
        .filter(ProductionRecord.status == "approved")
        .filter(
            ProductionRecord.municipality_id.in_(active_municipality_ids_subquery())
        )
    )
    if municipality_id is not None:
        q = q.filter(ProductionRecord.municipality_id == municipality_id)
    if start is not None:
        q = q.filter(ProductionRecord.record_date >= start)
    if end is not None:
        q = q.filter(ProductionRecord.record_date <= end)
    if production_method:
        q = q.filter(ProductionRecord.production_method == production_method)
    return q


def _monthly_series(municipality_id, start, end, production_method=None):
    """List of {month, total_mt} for approved records in [start, end].

    With a production_method filter the aggregation is done here so the
    monthly series matches the method the admin selected. Without a filter it
    reuses the shared _monthly_aggregates helper unchanged.
    """
    if not production_method:
        labels, values, _ = _monthly_aggregates(municipality_id, start, end)
        return [
            {"month": labels[i], "total_mt": round(values[i], 3)}
            for i in range(len(labels))
        ]
    rows = (
        _query_records(municipality_id, start, end, production_method)
        .with_entities(
            func.to_char(ProductionRecord.record_date, "YYYY-MM").label("m"),
            func.coalesce(func.sum(ProductionRecord.production_volume_mt), 0).label("v"),
        )
        .group_by(func.to_char(ProductionRecord.record_date, "YYYY-MM"))
        .order_by(func.to_char(ProductionRecord.record_date, "YYYY-MM"))
        .all()
    )
    return [
        {"month": r.m, "total_mt": round(float(r.v or 0), 3)}
        for r in rows
    ]


def _all_monthly_labels_values(municipality_id, end, production_method=None):
    """(labels, values) of approved production by month, 2000-01 up to `end`."""
    if not production_method:
        labels, values, _ = _monthly_aggregates(municipality_id, date(2000, 1, 1), end)
        return labels, values
    rows = (
        _query_records(municipality_id, date(2000, 1, 1), end, production_method)
        .with_entities(
            func.to_char(ProductionRecord.record_date, "YYYY-MM").label("m"),
            func.coalesce(func.sum(ProductionRecord.production_volume_mt), 0).label("v"),
        )
        .group_by(func.to_char(ProductionRecord.record_date, "YYYY-MM"))
        .order_by(func.to_char(ProductionRecord.record_date, "YYYY-MM"))
        .all()
    )
    return [r.m for r in rows], [float(r.v or 0) for r in rows]


def _complete_years(labels):
    """Set of years with at least _COMPLETE_YEAR_MONTHS months of data."""
    counts = {}
    for lb in labels:
        y = int(lb[:4])
        counts[y] = counts.get(y, 0) + 1
    return {y for y, c in counts.items() if c >= _COMPLETE_YEAR_MONTHS}


def _aggregate_production_rows(rows):
    # WHAT: Roll monthly production rows into province and municipality totals.
    # WHY: Descriptive KPIs, seasonality and shares all use these aggregates.
    monthly_totals = {}
    per_municipality = {}
    municipality_months = {}
    province_months = set()
    year_totals = {}
    for row in rows:
        label = f"{row.production_year:04d}-{row.production_month:02d}"
        value = float(row.production_kg) / 1000.0
        monthly_totals[label] = monthly_totals.get(label, 0.0) + value
        per_municipality.setdefault(row.municipality_id, {})[label] = value
        municipality_months.setdefault(row.municipality_id, set()).add(label)
        province_months.add(label)
        year_totals[row.production_year] = year_totals.get(row.production_year, 0.0) + value
    return monthly_totals, per_municipality, municipality_months, province_months, year_totals


def _seasonal_summary(all_labels, all_values):
    # WHAT: Build per-month averages and the year-by-year overlay.
    # WHY: Both views use only complete years, so partial data cannot skew them.
    complete_years = _complete_years(all_labels)
    year_month_totals = {
        year: {month: None for month in range(1, 13)}
        for year in complete_years
    }
    for label, value in zip(all_labels, all_values):
        year = int(label[:4])
        month = int(label[5:7])
        if year not in complete_years:
            continue
        existing = year_month_totals[year][month]
        year_month_totals[year][month] = (
            value if existing is None else existing + value
        )

    seasonal_pattern = []
    for month in range(1, 13):
        values_for_month = [
            year_month_totals[year][month]
            for year in complete_years
            if year_month_totals[year][month] is not None
        ]
        if values_for_month:
            seasonal_pattern.append({
                "month": month,
                "month_name": MONTH_NAMES[month - 1],
                "avg_mt": round(sum(values_for_month) / len(values_for_month), 3),
            })
    yearly_overlay = {
        str(year): [
            (
                round(year_month_totals[year][month], 3)
                if year_month_totals[year][month] is not None
                else None
            )
            for month in range(1, 13)
        ]
        for year in sorted(complete_years)
    }
    return seasonal_pattern, yearly_overlay


def _municipality_share_rows(per_municipality, municipality_names):
    # WHAT: Rank municipalities by recorded volume and share of the total.
    # WHY: The descriptive table needs one row per reporting municipality.
    grand_total = sum(sum(series.values()) for series in per_municipality.values())
    rows = []
    for muni_id, series in per_municipality.items():
        total = sum(series.values())
        rows.append({
            "id": muni_id,
            "name": municipality_names.get(muni_id, "Unknown"),
            "recorded_mt": round(total, 3),
            "share_pct": round(total / grand_total * 100, 1) if grand_total else 0.0,
            "record_count": len(series),
        })
    rows.sort(key=lambda row: row["recorded_mt"], reverse=True)
    return rows


def _production_descriptive(municipality_id, months):
    """Return descriptive history for the source-labeled production dataset."""
    latest = (
        MunicipalityMonthlyProduction.query
        .filter(
            MunicipalityMonthlyProduction.municipality_id.in_(
                active_municipality_ids_subquery()
            )
        )
        .order_by(
            MunicipalityMonthlyProduction.production_year.desc(),
            MunicipalityMonthlyProduction.production_month.desc(),
        )
        .first()
    )
    if latest is None:
        return jsonify({
            "scope": "all_municipalities" if municipality_id is None else municipality_id,
            "data_source": "municipality_production",
            "kpis": {"latest_record_month": None},
            "history": {
                "months_with_data": 0,
                "municipalities_with_data": 0,
                "municipalities_total": Municipality.query.filter_by(status="active").count(),
                "municipality_months": {},
            },
            "monthly_series": [],
            "seasonal_pattern": [],
        })

    latest_month = date(latest.production_year, latest.production_month, 1)
    end = add_months(latest_month, 1)
    all_rows_query = MunicipalityMonthlyProduction.query.filter(
        MunicipalityMonthlyProduction.production_year <= latest.production_year
    ).filter(
        MunicipalityMonthlyProduction.municipality_id.in_(
            active_municipality_ids_subquery()
        )
    )
    if municipality_id is not None:
        all_rows_query = all_rows_query.filter(
            MunicipalityMonthlyProduction.municipality_id == municipality_id
        )
    estimate_rows = all_rows_query.order_by(
        MunicipalityMonthlyProduction.production_year,
        MunicipalityMonthlyProduction.production_month,
    ).all()

    (
        monthly_totals,
        per_municipality,
        municipality_months,
        province_months,
        year_totals,
    ) = _aggregate_production_rows(estimate_rows)

    all_labels = sorted(monthly_totals)
    all_values = [monthly_totals[label] for label in all_labels]
    seasonal_pattern, yearly_overlay = _seasonal_summary(all_labels, all_values)

    municipality_names = {
        municipality.id: municipality.name
        for municipality in Municipality.query.filter_by(status="active").all()
    }
    by_municipality = _municipality_share_rows(per_municipality, municipality_names)

    this_year = latest.production_year
    last_year = this_year - 1
    last_year_total = year_totals.get(last_year, 0.0)
    this_year_total = year_totals.get(this_year, 0.0)
    yoy_change_pct = (
        round((this_year_total - last_year_total) / last_year_total * 100, 1)
        if last_year_total
        else None
    )
    series_start = month_start_offset(latest_month, -(months - 1))
    series_rows = [
        {"month": label, "total_mt": round(value, 3)}
        for label, value in zip(all_labels, all_values)
        if series_start <= date(int(label[:4]), int(label[5:7]), 1) < end
    ]
    best_month = (
        max(zip(all_labels, all_values), key=lambda item: item[1])[0]
        if all_values
        else None
    )
    history = {
        "months_with_data": len(province_months),
        "municipalities_with_data": len(municipality_months),
        "municipalities_total": Municipality.query.filter_by(status="active").count(),
        "municipality_months": {
            str(muni_id): len(labels)
            for muni_id, labels in municipality_months.items()
        },
    }
    return jsonify({
        "scope": "all_municipalities" if municipality_id is None else municipality_id,
        "data_source": "municipality_production",
        "filters": {"months": months, "production_method": None},
        "kpis": {
            "total_recorded_mt": round(sum(all_values), 3),
            "this_year_mt": round(this_year_total, 3),
            "last_year_mt": round(last_year_total, 3),
            "yoy_change_pct": yoy_change_pct,
            "best_month": best_month,
            "municipalities_reporting": len(by_municipality),
            "latest_record_month": (
                f"{latest.production_year:04d}-{latest.production_month:02d}"
            ),
        },
        "history": history,
        "monthly_series": series_rows,
        "yearly_overlay": yearly_overlay,
        "by_municipality": by_municipality,
        "seasonal_pattern": seasonal_pattern,
        "producers": [],
        "methods_share": [],
        "yield_by_municipality": [],
        "reporting_grid": [],
    })


# ===========================================================================
# Descriptive: What our data shows
# ===========================================================================

def _production_totals(municipality_id, production_method, this_year, last_year):
    # WHAT: All-time, this-year and last-year approved volume in one query.
    # WHY: The database is remote, so extra round trips cost page-load time.
    return (
        _query_records(municipality_id, production_method=production_method)
        .with_entities(
            func.coalesce(func.sum(ProductionRecord.production_volume_mt), 0).label("total"),
            func.coalesce(func.sum(case(
                (ProductionRecord.record_date.between(date(this_year, 1, 1), date(this_year, 12, 31)),
                 ProductionRecord.production_volume_mt),
                else_=0,
            )), 0).label("this_year"),
            func.coalesce(func.sum(case(
                (ProductionRecord.record_date.between(date(last_year, 1, 1), date(last_year, 12, 31)),
                 ProductionRecord.production_volume_mt),
                else_=0,
            )), 0).label("last_year"),
        )
        .one()
    )


def _approved_by_municipality(municipality_id, production_method):
    # WHAT: Approved volume and record counts grouped by municipality.
    # WHY: Feeds the ranking table and the producer/yield panels.
    query = (
        db.session.query(
            ProductionRecord.municipality_id,
            Municipality.name,
            func.sum(ProductionRecord.production_volume_mt).label("total_volume"),
            func.count(ProductionRecord.id).label("record_count"),
        )
        .join(Municipality, Municipality.id == ProductionRecord.municipality_id)
        .filter(ProductionRecord.status == "approved")
        .filter(Municipality.status == "active")
    )
    if municipality_id is not None:
        query = query.filter(ProductionRecord.municipality_id == municipality_id)
    if production_method:
        query = query.filter(ProductionRecord.production_method == production_method)
    return query.group_by(
        ProductionRecord.municipality_id, Municipality.name
    ).all()


def _municipality_rows_payload(muni_rows):
    # WHAT: Convert grouped rows into the ranked municipality table.
    # WHY: Share percentages need the province-wide total first.
    grand_total = sum(float(row.total_volume or 0) for row in muni_rows)
    rows = []
    for row in muni_rows:
        volume = float(row.total_volume or 0)
        rows.append({
            "id": row.municipality_id,
            "name": row.name,
            "recorded_mt": round(volume, 3),
            "share_pct": round((volume / grand_total * 100), 1) if grand_total > 0 else 0.0,
            "record_count": int(row.record_count or 0),
        })
    rows.sort(key=lambda item: item["recorded_mt"], reverse=True)
    return rows


def _approved_seasonal_summary(all_labels, all_values):
    # WHAT: Average by calendar month over complete years, plus a yearly overlay.
    # WHY: Incomplete years would otherwise pull the seasonal average down.
    complete_years = sorted(_complete_years(all_labels))
    month_totals = {month: 0.0 for month in range(1, 13)}
    month_counts = {month: 0 for month in range(1, 13)}
    for label, value in zip(all_labels, all_values):
        year = int(label[:4])
        month = int(label[5:7])
        if year in complete_years:
            month_totals[month] += value
            month_counts[month] += 1
    yearly_overlay = {
        str(year): [
            round(month_totals[month] / month_counts[month], 3)
            if month_counts[month] > 0
            else 0.0
            for month in range(1, 13)
        ]
        for year in complete_years
    }
    seasonal_pattern = []
    for month in range(1, 13):
        if month_counts[month] > 0:
            seasonal_pattern.append({
                "month": month,
                "month_name": MONTH_NAMES[month - 1],
                "avg_mt": round(month_totals[month] / month_counts[month], 3),
            })
    return yearly_overlay, seasonal_pattern


def _producer_payload(muni_rows, municipality_id, production_method):
    # WHAT: Producer counts and age buckets per municipality in one grouped query.
    # WHY: Avoids two extra round trips per municipality.
    agg_rows = (
        _query_records(municipality_id, production_method=production_method)
        .with_entities(
            ProductionRecord.municipality_id,
            func.coalesce(func.sum(ProductionRecord.registered_producers), 0).label("registered"),
            func.coalesce(func.sum(ProductionRecord.male_producers), 0).label("male"),
            func.coalesce(func.sum(ProductionRecord.female_producers), 0).label("female"),
            *[func.coalesce(func.sum(getattr(ProductionRecord, f)), 0).label(f) for f in [
                "producers_18_30", "producers_31_40", "producers_41_50",
                "producers_51_60", "producers_61_plus",
            ]],
            func.coalesce(func.sum(ProductionRecord.production_volume_mt), 0).label("volume"),
            func.coalesce(func.sum(ProductionRecord.num_salt_beds), 0).label("beds"),
            func.coalesce(func.sum(ProductionRecord.num_salt_beds * ProductionRecord.area_per_salt_bed), 0).label("area_m2"),
        )
        .group_by(ProductionRecord.municipality_id)
        .all()
    )
    agg_by_muni = {row.municipality_id: row for row in agg_rows}

    payload = []
    for row in muni_rows:
        muni_id = row.municipality_id
        agg = agg_by_muni.get(muni_id)
        if agg is None:
            continue
        payload.append({
            "municipality_id": muni_id,
            "municipality_name": row.name,
            "registered_producers": int(agg.registered or 0),
            "male_producers": int(agg.male or 0),
            "female_producers": int(agg.female or 0),
            "age_buckets": {
                "18-30": int(agg.producers_18_30 or 0),
                "31-40": int(agg.producers_31_40 or 0),
                "41-50": int(agg.producers_41_50 or 0),
                "51-60": int(agg.producers_51_60 or 0),
                "61+": int(agg.producers_61_plus or 0),
            },
        })
    return payload, agg_by_muni


def _methods_share(municipality_id):
    # WHAT: Production volume per method with its share of the total.
    # WHY: The method donut uses all approved records in scope.
    rows = (
        _query_records(municipality_id)
        .with_entities(
            ProductionRecord.production_method,
            func.coalesce(func.sum(ProductionRecord.production_volume_mt), 0).label("volume"),
        )
        .group_by(ProductionRecord.production_method)
        .all()
    )
    total = sum(float(row.volume or 0) for row in rows)
    payload = [
        {
            "method": row.production_method,
            "volume_mt": round(float(row.volume or 0), 3),
            "share_pct": round((float(row.volume or 0) / total * 100), 1) if total > 0 else 0.0,
        }
        for row in rows
    ]
    payload.sort(key=lambda item: item["volume_mt"], reverse=True)
    return payload


def _yield_payload(muni_rows, agg_by_muni):
    # WHAT: Yield per salt bed and per hectare for each municipality.
    # WHY: A municipality without beds or area has no yield, so it is skipped.
    payload = []
    for row in muni_rows:
        agg = agg_by_muni.get(row.municipality_id)
        if agg is None:
            continue
        volume = float(agg.volume or 0)
        beds = int(agg.beds or 0)
        area_m2 = float(agg.area_m2 or 0)
        yield_per_bed = round(volume / beds, 3) if beds > 0 else None
        yield_per_ha = round(volume / (area_m2 / 10000.0), 3) if area_m2 > 0 else None
        payload.append({
            "municipality_id": row.municipality_id,
            "municipality_name": row.name,
            "yield_per_bed_mt": yield_per_bed,
            "yield_per_ha_mt": yield_per_ha,
            # DEPRECATED alias: kept for backward compatibility.
            "yield_per_bed": yield_per_bed,
            "area_per_salt_bed_m2": round(area_m2 / beds, 2) if beds > 0 else None,
        })
    return payload


def _approved_history(production_method):
    # WHAT: Count distinct reporting months per municipality and province-wide.
    # WHY: The Data Readiness KPI counts real reporting months, never zero-filled ones.
    rows = (
        _query_records(None, production_method=production_method)
        .with_entities(
            ProductionRecord.municipality_id,
            func.to_char(ProductionRecord.record_date, "YYYY-MM").label("m"),
        )
        .distinct()
        .all()
    )
    municipality_months = {}
    province_months = set()
    for row in rows:
        municipality_months.setdefault(row.municipality_id, set()).add(row.m)
        province_months.add(row.m)
    return {
        "months_with_data": len(province_months),
        "municipalities_with_data": len([months for months in municipality_months.values() if months]),
        "municipalities_total": Municipality.query.filter_by(status="active").count(),
        "municipality_months": {str(key): len(months) for key, months in municipality_months.items()},
    }


@analytics_api_bp.route("/descriptive", methods=["GET"])
@login_required
def descriptive():
    """Descriptive analytics for approved production records.

    Measures (units): total_recorded_mt (MT), this_year_mt / last_year_mt (MT),
    yoy_change_pct (%), best_month (month), municipalities_reporting (count),
    latest_record_month (month). Monthly series in MT; yearly overlay in MT;
    by_municipality recorded_mt (MT) + share_pct (%); seasonal_pattern avg_mt
    (MT); producers counts; methods share (MT); yield_per_bed_mt (MT/bed) and
    yield_per_ha_mt (MT/ha); reporting_grid (boolean per municipality/month).

    Query: municipality_id (optional, defaults to all active municipalities),
           months (optional, how many calendar months of monthly history to
           return; default 24, max 120),
           production_method (optional solar|cooked|hybrid; narrows every
           approved-record query in this response).
    """
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    municipality_id = request.args.get("municipality_id", type=int)
    months = request.args.get("months", type=int) or 24
    months = max(1, min(120, months))
    production_method = request.args.get("production_method") or None
    source = request.args.get("source", "approved_records")
    if source == "municipality_estimates":
        source = "municipality_production"
    if source == "municipality_production":
        if production_method:
            return jsonify({
                "error": "Production-method filters are unavailable for this production dataset."
            }), 400
        return _production_descriptive(municipality_id, months)
    if source != "approved_records":
        return jsonify({"error": "source must be approved_records or municipality_production."}), 400

    today = date.today()
    this_year = today.year
    last_year = this_year - 1

    # Approved records overall for KPI scope. All-time, this year and last year
    # come from ONE query: the database is remote, so every extra round trip
    # costs real page-load time.
    totals_row = _production_totals(
        municipality_id, production_method, this_year, last_year
    )
    total_recorded = totals_row.total
    this_year_mt = totals_row.this_year
    last_year_mt = totals_row.last_year
    yoy_change_pct = None
    if last_year_mt:
        yoy_change_pct = round(((this_year_mt - last_year_mt) / last_year_mt) * 100, 1)

    # Best month (all time, by month total).
    labels, values = _all_monthly_labels_values(municipality_id, today, production_method)
    best_month = None
    if values:
        best_idx = max(range(len(values)), key=lambda i: values[i])
        best_month = labels[best_idx]

    # Municipalities reporting (have at least one approved record).
    muni_rows = _approved_by_municipality(municipality_id, production_method)
    by_municipality = _municipality_rows_payload(muni_rows)
    municipalities_reporting = len(by_municipality)

    # Latest record month.
    latest_row = (
        _query_records(municipality_id, production_method=production_method)
        .order_by(ProductionRecord.record_date.desc()).first()
    )
    latest_record_month = None
    if latest_row:
        latest_record_month = f"{latest_row.record_date.year:04d}-{latest_row.record_date.month:02d}"

    # Monthly series: the last `months` calendar months (default 24).
    series_start = month_start_offset(date(today.year, today.month, 1), -(months - 1))
    monthly_series = _monthly_series(municipality_id, series_start, today, production_method)

    # Yearly overlay {year: [12 values]} and seasonal averages, complete years only.
    all_labels, all_values = labels, values
    yearly_overlay, seasonal_pattern = _approved_seasonal_summary(all_labels, all_values)

    # Producers + yield per municipality, in ONE grouped query.
    producers_by_municipality, agg_by_muni = _producer_payload(
        muni_rows, municipality_id, production_method
    )

    # Methods share (MT) from production_method.
    methods_share = _methods_share(municipality_id)

    # Yield per salt bed and per hectare by municipality.
    yield_by_municipality = _yield_payload(muni_rows, agg_by_muni)

    # Reporting grid: last 36 months, which months each municipality reported.
    muni_ids_in_scope = [r.municipality_id for r in muni_rows] or ([municipality_id] if municipality_id else [])
    municipality_names = {r.municipality_id: r.name for r in muni_rows}
    grid_labels, reporting_grid = _reporting_grid(
        muni_ids_in_scope,
        municipality_names,
        range_months=36,
    )

    # History coverage: distinct calendar months that carry approved records.
    history = _approved_history(production_method)

    return jsonify({
        "scope": "all_municipalities" if municipality_id is None else municipality_id,
        "data_source": "approved_records",
        "filters": {
            "months": months,
            "production_method": production_method,
        },
        "kpis": {
            "total_recorded_mt": round(float(total_recorded), 3),
            "this_year_mt": round(float(this_year_mt), 3),
            "last_year_mt": round(float(last_year_mt), 3),
            "yoy_change_pct": yoy_change_pct,
            "best_month": best_month,
            "municipalities_reporting": municipalities_reporting,
            "latest_record_month": latest_record_month,
        },
        "history": history,
        "monthly_series": monthly_series,
        "yearly_overlay": yearly_overlay,
        "by_municipality": by_municipality,
        "seasonal_pattern": seasonal_pattern,
        "producers": producers_by_municipality,
        "methods_share": methods_share,
        "yield_by_municipality": yield_by_municipality,
        "reporting_grid": reporting_grid,
    })


# ===========================================================================
# Predictive: What to expect
# ===========================================================================

def _demand_benchmark(municipality_id=None):
    """Latest provincial demand benchmark. Returns dict or None."""
    prov = (
        DemandBenchmark.query.filter_by(geographic_scope="provincial")
        .order_by(DemandBenchmark.year.desc())
        .first()
    )
    if not prov:
        return None
    return {
        "benchmark_year": prov.year,
        "annual_demand_mt": float(prov.demand_volume),
        "local_production_mt": float(prov.local_production) if prov.local_production is not None else None,
        "import_volume_mt": float(prov.import_volume) if prov.import_volume is not None else None,
        "source_name": prov.source_name,
    }


def _period_demand(annual_demand_mt, months, growth_pct, years_ahead):
    """period_demand_mt = annual * months/12 * (1+growth)^years_ahead."""
    if not annual_demand_mt:
        return None
    factor = (1 + growth_pct / 100.0) ** years_ahead
    return round(annual_demand_mt * (months / 12.0) * factor, 3)


def _resolve_forecast_period(range_opt, start, end, today, last_data_date):
    # WHAT: Turn the range option and custom dates into one period window.
    # WHY: Every predictive total must use exactly the same start, end and months.
    period = {"start": None, "end": None, "months": 0, "label": range_opt}
    if range_opt == "this_month":
        period["start"] = date(today.year, today.month, 1)
        period["end"] = add_months(period["start"], 0)
        period["months"] = 1
        period["label"] = "This month"
    elif range_opt == "next_3":
        base = add_months(last_data_date, 1) if last_data_date else today
        period["start"] = date(base.year, base.month, 1)
        period["end"] = add_months(period["start"], 2)
        period["months"] = 3
        period["label"] = "Next 3 months"
    elif range_opt == "rest_of_year":
        base = add_months(last_data_date, 1) if last_data_date else today
        period["start"] = date(base.year, base.month, 1)
        period["end"] = date(base.year, 12, 31)
        period["months"] = max(1, 12 - base.month + 1)
        period["label"] = "Rest of this year"
    elif range_opt == "custom" and start and end:
        period["start"] = date(start.year, start.month, 1)
        period["end"] = add_months(date(end.year, end.month, 1), 0)
        period["months"] = (end.year - start.year) * 12 + (end.month - start.month) + 1
        period["label"] = "Custom period"
    else:  # next_12 default
        base = add_months(last_data_date, 1) if last_data_date else today
        period["start"] = date(base.year, base.month, 1)
        period["end"] = add_months(period["start"], 11)
        period["months"] = 12
        period["label"] = "Next 12 months"
    if period["months"] < 1:
        period["months"] = 1
    return period


def _summarize_forecast_points(points, period):
    # WHAT: Split forecast points into history and future series for the period.
    # WHY: Headline totals, bounds and the chart series must share one pass.
    history = []
    forecast_series = []
    forecast_mt = 0.0
    range_low_mt = None
    range_high_mt = None
    recorded_to_date_mt = None

    def in_period(label):
        if period["start"] is None:
            return True
        point_date = date(int(label[:4]), int(label[5:7]), 1)
        return period["start"] <= point_date <= period["end"]

    for point in points:
        label = point.period_label
        entry = {
            "period_label": label,
            "predicted_value": round(float(point.predicted_value or 0), 3),
            "is_forecast": bool(point.is_forecast),
        }
        if point.lower_bound is not None:
            entry["lower_bound"] = round(float(point.lower_bound), 3)
        if point.upper_bound is not None:
            entry["upper_bound"] = round(float(point.upper_bound), 3)
        if point.is_forecast:
            forecast_series.append(entry)
            if not in_period(label):
                continue
            forecast_mt += float(point.predicted_value or 0)
            if range_low_mt is None or (
                point.lower_bound is not None and float(point.lower_bound) < range_low_mt
            ):
                range_low_mt = (
                    float(point.lower_bound) if point.lower_bound is not None else range_low_mt
                )
            if range_high_mt is None or (
                point.upper_bound is not None and float(point.upper_bound) > range_high_mt
            ):
                range_high_mt = (
                    float(point.upper_bound) if point.upper_bound is not None else range_high_mt
                )
        elif in_period(label):
            history.append(entry)
            if recorded_to_date_mt is None:
                recorded_to_date_mt = 0.0
            recorded_to_date_mt += float(point.predicted_value or 0)

    return (
        history,
        forecast_series,
        forecast_mt,
        range_low_mt,
        range_high_mt,
        recorded_to_date_mt,
        in_period,
    )


def _demand_contribution(municipality_id):
    # WHAT: Compare recorded production against each benchmark year.
    # WHY: Shows whether the province exceeded its local-production benchmark.
    contribution = []
    benchmarks = (
        DemandBenchmark.query.filter_by(geographic_scope="provincial")
        .order_by(DemandBenchmark.year.desc())
        .all()
    )
    for benchmark in benchmarks:
        recorded = (
            _query_records(
                municipality_id,
                date(benchmark.year, 1, 1),
                date(benchmark.year, 12, 31),
            )
            .with_entities(func.coalesce(func.sum(ProductionRecord.production_volume_mt), 0))
            .scalar()
            or 0
        )
        recorded = float(recorded)
        local = float(benchmark.local_production) if benchmark.local_production is not None else None
        imports = float(benchmark.import_volume) if benchmark.import_volume is not None else None
        coverage_pct = (
            round((recorded / float(benchmark.demand_volume) * 100), 1)
            if benchmark.demand_volume
            else None
        )
        share_local = round((recorded / local * 100), 1) if local else None
        import_share = (
            round((imports / float(benchmark.demand_volume) * 100), 1)
            if (benchmark.demand_volume and imports is not None)
            else None
        )
        flagged = None
        if local is not None and recorded > local:
            flagged = "Recorded production exceeds local production benchmark for this year."
        contribution.append({
            "year": benchmark.year,
            "recorded_mt": round(recorded, 3),
            "demand_mt": float(benchmark.demand_volume),
            "other_local_mt": local,
            "imports_mt": imports,
            "recorded_coverage_pct": coverage_pct,
            "recorded_share_of_local_pct": share_local,
            "import_share_pct": import_share,
            # DEPRECATED alias.
            "recorded_coverage": coverage_pct,
            "flagged": flagged,
        })
    return contribution


def _by_municipality_forecast(in_period):
    # WHAT: Sum each municipality's latest forecast run over the period.
    # WHY: The per-municipality table must reconcile with the headline total.
    payload = []
    municipalities = (
        Municipality.query.filter_by(status="active").order_by(Municipality.name).all()
    )
    for municipality in municipalities:
        run = (
            ForecastRun.query.filter_by(
                municipality_id=municipality.id,
                data_source=PRODUCTION_DATA_SOURCE,
            )
            .order_by(ForecastRun.created_at.desc())
            .first()
        )
        forecast_mt = 0.0
        if run and run.points:
            for point in run.points:
                if point.is_forecast and in_period(point.period_label):
                    forecast_mt += float(point.predicted_value or 0)
        payload.append({
            "municipality_id": municipality.id,
            "municipality_name": municipality.name,
            "forecast_mt": round(forecast_mt, 3),
        })
    payload.sort(key=lambda item: item["forecast_mt"], reverse=True)
    return payload


def _sufficiency_and_confidence(forecast_run):
    # WHAT: Map run readiness/reliability to the public labels.
    # WHY: Insufficient history must always report low confidence.
    readiness = forecast_run.readiness or "not_ready"
    if readiness == "ready":
        return "sufficient", forecast_run.reliability or "moderate"
    if readiness == "limited":
        return "limited", "low"
    return "insufficient", "low"


@analytics_api_bp.route("/predictive", methods=["GET"])
@login_required
def predictive():
    """Predictive analytics: forecast production vs salt demand for a period.

    Measures: forecast_mt / range_low_mt / range_high_mt (MT),
    recorded_to_date_mt (MT), demand_shortfall_mt (MT), covered_pct (%),
    recorded_coverage_pct (%), recorded_share_of_local_pct (%),
    import_share_pct (%), data_sufficiency, forecast_confidence, forecast_method,
    partial_reporting_tail, backtest, model_comparison.

    Query: municipality_id, range (this_month|next_3|rest_of_year|next_12|custom),
    start, end, growth_pct (default 0).
    """
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    municipality_id = request.args.get("municipality_id", type=int)
    if municipality_id is not None and not is_active_municipality(municipality_id):
        return jsonify({"error": "municipality_id is invalid or inactive."}), 400
    range_opt = request.args.get("range") or "next_12"
    start = _parse_date(request.args.get("start")) if request.args.get("start") else None
    end = _parse_date(request.args.get("end")) if request.args.get("end") else None
    growth_pct = float(request.args.get("growth_pct") or 0)

    today = date.today()
    # Resolve the requested period.
    last_ym = _last_month_with_data(municipality_id, source="production")
    last_data_date = None
    if last_ym:
        last_data_date = date(int(last_ym[:4]), int(last_ym[5:7]), 1)
    period = _resolve_forecast_period(range_opt, start, end, today, last_data_date)

    # Run forecast for the scope (auto window; 12-month horizon default).
    horizon = max(period["months"], 12)
    if municipality_id is None:
        forecast_run = run_forecast_all_municipalities(horizon)
        scope_label = scope_all_label()
    else:
        forecast_run = run_forecast(municipality_id, horizon)
        forecast_municipality = db.session.get(Municipality, municipality_id)
        scope_label = (
            forecast_municipality.name if forecast_municipality else str(municipality_id)
        )

    # Build series: history + forecast with bounds.
    points = sorted(forecast_run.points, key=lambda p: p.period_label) if forecast_run.points else []
    (
        history,
        forecast_series,
        forecast_mt,
        range_low_mt,
        range_high_mt,
        recorded_to_date_mt,
        in_period,
    ) = _summarize_forecast_points(points, period)

    # Demand.
    demand = _demand_benchmark(municipality_id)
    annual_demand = demand["annual_demand_mt"] if demand else None
    period_demand = _period_demand(annual_demand, period["months"], growth_pct, 0) if annual_demand else None
    demand_shortfall = None
    covered_pct = None
    if period_demand is not None:
        demand_shortfall = round(period_demand - forecast_mt, 3)
        covered_pct = round((forecast_mt / period_demand * 100), 1) if period_demand > 0 else None

    # Contribution per benchmark year.
    contribution = _demand_contribution(municipality_id) if demand else []

    # Per-municipality forecast MT for the selected period.
    by_muni_forecast = _by_municipality_forecast(in_period)

    # Data sufficiency / confidence.
    data_sufficiency, forecast_confidence = _sufficiency_and_confidence(forecast_run)

    # Assumptions (plain language).
    assumptions = [
        "Future demand is the latest demand benchmark held flat, plus an optional annual growth % (default 0%).",
        "Recorded coverage counts approved records from active municipalities only; actual production may be higher.",
        "Partial-month reporting: the current month may be under-reported because the year is still in progress.",
        f"Forecast method used: {forecast_run.algorithm or 'none'}.",
    ]
    if forecast_run.incomplete_tail:
        assumptions.append("Incomplete recent months detected; forecast is anchored to the established seasonal pattern.")

    return jsonify({
        "scope": scope_label,
        "municipality_id": municipality_id,
        "period": period,
        "growth_pct": growth_pct,
        "production": {
            "forecast_mt": round(forecast_mt, 3),
            "range_low_mt": round(range_low_mt, 3) if range_low_mt is not None else None,
            "range_high_mt": round(range_high_mt, 3) if range_high_mt is not None else None,
            "recorded_to_date_mt": round(recorded_to_date_mt, 3) if recorded_to_date_mt is not None else None,
        },
        "series": history + forecast_series,
        "by_municipality": by_muni_forecast,
        "demand": {
            "scope": "provincial",
            "benchmark_year": demand["benchmark_year"] if demand else None,
            "annual_demand_mt": annual_demand,
            "assumed_growth_pct": growth_pct,
            "period_demand_mt": period_demand,
            "demand_shortfall_mt": demand_shortfall,
            "covered_pct": covered_pct,
            # DEPRECATED aliases.
            "local_production_mt": demand["local_production_mt"] if demand else None,
            "import_volume_mt": demand["import_volume_mt"] if demand else None,
        },
        "contribution": contribution,
        "assumptions": assumptions,
        "data_sufficiency": data_sufficiency,
        "forecast_confidence": forecast_confidence,
        "forecast_method": forecast_run.algorithm or "none",
        "partial_reporting_tail": bool(forecast_run.incomplete_tail),
        "note": forecast_run.note,
        "model_comparison": forecast_run.candidate_metrics and [
            {
                "algorithm": k,
                "rmse": (v or {}).get("rmse"),
                "mae": (v or {}).get("mae"),
                "mape": (v or {}).get("mape"),
            }
            for k, v in forecast_run.candidate_metrics.items()
        ],
        "backtest": forecast_run.backtest if hasattr(forecast_run, "backtest") else None,
    })
