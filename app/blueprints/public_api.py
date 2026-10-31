"""Public, unauthenticated endpoints that power the guest dashboard.

These aggregate production records, municipalities, and demand benchmarks
stored in the database (Supabase) into the shape the public React dashboard
expects. No login is required.
"""
from flask import Blueprint, jsonify
from datetime import datetime, date, timedelta, timezone
from types import SimpleNamespace
from sqlalchemy import func

from app.extensions import db
from app.models.municipality import Municipality
from app.models.production_record import ProductionRecord
from app.models.producer_report import ProducerReport, ProducerReportEntry
from app.models.demand_benchmark import DemandBenchmark
from app.models.municipality_production import (
    MunicipalityMonthlyProduction,
    MunicipalitySaltBedData,
)
from app.services.forecast_service import _monthly_aggregates
from app.services.municipality_directory import (
    active_municipalities,
    active_municipality_ids_subquery,
    normalized_name,
)
from app.services.municipality_service import slugify as municipality_slug

public_api_bp = Blueprint("public_api", __name__, url_prefix="/api/public")

AGE_FIELDS = [
    "producers_18_30",
    "producers_31_40",
    "producers_41_50",
    "producers_51_60",
    "producers_61_plus",
]


PRODUCTION_SOURCE_LABEL = "Adjusted_Estimates.xlsx"


def _latest_production_month():
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
        return None
    return date(latest.production_year, latest.production_month, 1)


def _iso_utc(value):
    """Return a timestamp as ISO-8601 UTC (``...Z``), or None.

    WHAT: The database stores naive UTC timestamps (``datetime.utcnow``).
    WHY: The browser formats this value in Asia/Manila, so the API must be
         explicit that the value is UTC instead of leaving it ambiguous.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def _month_with_offset(month_start, offset):
    month_index = month_start.year * 12 + month_start.month - 1 + offset
    year, month_index = divmod(month_index, 12)
    return date(year, month_index + 1, 1)


def _municipality_summary():
    latest = _latest_production_month()
    if latest is None:
        return [], {}, {}

    current_start = _month_with_offset(latest, -11)
    previous_start = _month_with_offset(latest, -23)
    current_end_index = latest.year * 12 + latest.month - 1
    current_start_index = current_start.year * 12 + current_start.month - 1
    previous_start_index = previous_start.year * 12 + previous_start.month - 1

    current_totals = {}
    previous_totals = {}
    for production in (
        MunicipalityMonthlyProduction.query
        .filter(
            MunicipalityMonthlyProduction.municipality_id.in_(
                active_municipality_ids_subquery()
            )
        )
        .all()
    ):
        month_index = production.production_year * 12 + production.production_month - 1
        target = (
            current_totals
            if current_start_index <= month_index <= current_end_index
            else previous_totals
            if previous_start_index <= month_index < current_start_index
            else None
        )
        if target is not None:
            target[production.municipality_id] = (
                target.get(production.municipality_id, 0.0)
                + float(production.production_kg) / 1000.0
            )

    salt_bed_data = {}
    for bed_data in MunicipalitySaltBedData.query.order_by(
        MunicipalitySaltBedData.data_year.desc()
    ).all():
        salt_bed_data.setdefault(bed_data.municipality_id, bed_data)

    rows = []
    for municipality in Municipality.query.filter_by(status="active").order_by(
        Municipality.name
    ).all():
        bed_data = salt_bed_data.get(municipality.id)
        rows.append(SimpleNamespace(
            id=municipality.id,
            name=municipality.name,
            latitude=municipality.latitude,
            longitude=municipality.longitude,
            geojson_ref=municipality.geojson_ref,
            current_mt=current_totals.get(municipality.id, 0.0),
            previous_mt=previous_totals.get(municipality.id, 0.0),
            current_beds=bed_data.bed_count if bed_data else 0,
            current_area_sqm=None,
            salt_beds_year=bed_data.data_year if bed_data else None,
            salt_beds_confidence=(
                bed_data.confidence_and_notes if bed_data else None
            ),
        ))

    end = _month_with_offset(latest, 1) - timedelta(days=1)
    return rows, {}, (current_start, end)


def _demographics():
    rows = (
        db.session.query(
            ProductionRecord.municipality_id,
            func.sum(func.coalesce(ProductionRecord.male_producers, 0)).label("male"),
            func.sum(func.coalesce(ProductionRecord.female_producers, 0)).label("female"),
            *(func.sum(func.coalesce(getattr(ProductionRecord, f), 0)).label(f) for f in AGE_FIELDS),
        )
        .filter(ProductionRecord.status == "approved")
        .filter(
            ProductionRecord.municipality_id.in_(active_municipality_ids_subquery())
        )
        .group_by(ProductionRecord.municipality_id)
        .all()
    )

    by_municipality = {}
    province = {a: 0 for a in AGE_FIELDS}
    province["male"] = 0
    province["female"] = 0
    province["notSpecified"] = 0
    for r in rows:
        age_groups = {a: int(getattr(r, a) or 0) for a in AGE_FIELDS}
        gender = {"male": int(r.male or 0), "female": int(r.female or 0), "notSpecified": 0}
        by_municipality[str(r.municipality_id)] = {
            "ageGroups": age_groups,
            "genderDistribution": gender,
        }
        for a in AGE_FIELDS:
            province[a] += age_groups[a]
        province["male"] += gender["male"]
        province["female"] += gender["female"]

    age_fields_by_label = {
        "18-30": "producers_18_30",
        "31-40": "producers_31_40",
        "41-50": "producers_41_50",
        "51-60": "producers_51_60",
        "61+": "producers_61_plus",
    }
    producer_rows = (
        db.session.query(
            ProducerReport.municipality_id,
            ProducerReportEntry.age,
            ProducerReportEntry.age_bracket,
            ProducerReportEntry.sex,
            func.count(ProducerReportEntry.id).label("producer_count"),
        )
        .join(ProducerReportEntry, ProducerReportEntry.report_id == ProducerReport.id)
        .filter(ProducerReport.status == "approved")
        .filter(
            ProducerReport.municipality_id.in_(active_municipality_ids_subquery())
        )
        .group_by(ProducerReport.municipality_id, ProducerReportEntry.age, ProducerReportEntry.age_bracket, ProducerReportEntry.sex)
        .all()
    )
    for row in producer_rows:
        municipality_key = str(row.municipality_id)
        municipality = by_municipality.setdefault(municipality_key, {
            "ageGroups": {field: 0 for field in AGE_FIELDS},
            "genderDistribution": {"male": 0, "female": 0, "notSpecified": 0},
        })
        count = int(row.producer_count or 0)
        if row.age is not None:
            age_field = (
                "producers_18_30" if row.age <= 30 else
                "producers_31_40" if row.age <= 40 else
                "producers_41_50" if row.age <= 50 else
                "producers_51_60" if row.age <= 60 else
                "producers_61_plus"
            )
        else:
            age_field = age_fields_by_label.get(row.age_bracket)
        if age_field:
            municipality["ageGroups"][age_field] += count
            province[age_field] += count
        sex_key = {"Male": "male", "Female": "female"}.get(row.sex, "notSpecified")
        municipality["genderDistribution"][sex_key] += count
        province[sex_key] += count

    age_labels = ["18-30", "31-40", "41-50", "51-60", "61+"]
    province_age = {
        label: province[AGE_FIELDS[i]] for i, label in enumerate(age_labels)
    }
    province_gender = {
        "male": province["male"],
        "female": province["female"],
        "notSpecified": province["notSpecified"],
    }
    return {
        "provinceWide": {
            "ageGroups": province_age,
            "genderDistribution": province_gender,
        },
        "byMunicipality": by_municipality,
        "dataSource": "approved_records",
    }


def _production():
    monthly_production = (
        MunicipalityMonthlyProduction.query
        .filter(
            MunicipalityMonthlyProduction.municipality_id.in_(
                active_municipality_ids_subquery()
            )
        )
        .order_by(
            MunicipalityMonthlyProduction.production_year,
            MunicipalityMonthlyProduction.production_month,
        )
        .all()
    )
    if not monthly_production:
        return {
            "provinceTotalMT": 0.0,
            "records": [],
            "latestRecordDate": None,
            "lastUpdatedAt": None,
            "dataSource": "municipality_production",
            "sourceLabel": PRODUCTION_SOURCE_LABEL,
        }

    records = [
        {
            "year": production.production_year,
            "month": production.production_month,
            "totalMT": round(float(production.production_kg) / 1000.0, 3),
            "isDerived": False,
            "isSynthetic": production.is_synthetic,
        }
        for production in monthly_production
    ]
    province_total_mt = round(sum(row["totalMT"] for row in records), 3)

    # WHAT: The newest monthly period, shown as its last calendar day.
    # WHY: The workbook dataset is monthly, so the exact "data as of" date is
    #      the final day of the latest month it covers (e.g. 2026-09 -> 30 Sep).
    latest = monthly_production[-1]
    latest_record_date = (
        _month_with_offset(date(latest.production_year, latest.production_month, 1), 1)
        - timedelta(days=1)
    )

    # WHAT: The publish/import time of the public municipality dataset.
    # WHY: municipality_monthly_production has no updated_at or approval field,
    #      so created_at is the best available timestamp for this dataset.
    last_updated_at = db.session.query(
        func.max(MunicipalityMonthlyProduction.created_at)
    ).filter(
        MunicipalityMonthlyProduction.municipality_id.in_(
            active_municipality_ids_subquery()
        )
    ).scalar()

    return {
        "provinceTotalMT": province_total_mt,
        "records": records,
        "latestRecordDate": latest_record_date.isoformat(),
        "lastUpdatedAt": _iso_utc(last_updated_at),
        "dataSource": "municipality_production",
        "sourceLabel": PRODUCTION_SOURCE_LABEL,
    }


def _supply_demand():
    provincial = (
        DemandBenchmark.query.filter_by(geographic_scope="provincial")
        .order_by(DemandBenchmark.year.desc())
        .first()
    )
    national = (
        DemandBenchmark.query.filter_by(geographic_scope="national")
        .order_by(DemandBenchmark.year.desc())
        .first()
    )
    latest_month = _latest_production_month()
    if latest_month is None:
        pangasinan_local_mt = 0.0
        supply_start = None
        supply_end = None
    else:
        supply_start = _month_with_offset(latest_month, -11)
        supply_end = _month_with_offset(latest_month, 1) - timedelta(days=1)
        _, monthly_values, _ = _monthly_aggregates(
            None,
            supply_start,
            supply_end,
            source="production",
        )
        pangasinan_local_mt = sum(monthly_values)
    pangasinan = {
        "localSupply": round(float(pangasinan_local_mt), 3),
        "demandBenchmark": float(provincial.demand_volume) if provincial else None,
        "year": provincial.year if provincial else datetime.utcnow().year,
        "localSupplyPeriod": (
            {
                "start": f"{supply_start.year:04d}-{supply_start.month:02d}",
                "end": f"{latest_month.year:04d}-{latest_month.month:02d}",
            }
            if latest_month
            else None
        ),
        "dataSource": "municipality_production",
    }
    philippines = {
        "demand": float(national.demand_volume) if national else None,
        "domesticSupply": float(national.local_production) if national and national.local_production is not None else None,
        "imports": float(national.import_volume) if national and national.import_volume is not None else None,
        "year": national.year if national else None,
    }
    sector_demand = {
        "household": 320000.0,
        "foodProcessing": 180000.0,
        "industry": 120000.0,
        "agriculture": 63608.0,
    }
    return {
        "philippines": philippines,
        "pangasinan": pangasinan,
        "sectorDemand": sector_demand,
        "asOfDate": (
            f"{latest_month.strftime('%B %Y')}" if latest_month else None
        ),
    }


# WHAT: Short public insight per municipality, keyed by normalized name.
# WHY: Municipality ids are database-managed (and can be recreated), so a name
#      key stays correct; an unknown name simply has no snippet.
INSIGHTS = {
    "alaminos city": "Alaminos City's coastal brine flats support sustained solar output; forecast readiness depends on the depth of its record history.",
    "anda": "Anda enjoys steady coastal brine access and extended dry-season periods that support consistent solar evaporation.",
    "bani": "Bani relies more heavily on cooked production where open evaporation area is limited and labor is readily available.",
    "bolinao": "Bolinao's large coastal tracts and strong north-easterly winds reduce drying time, sustaining high solar output.",
    "dasol": "Dasol shows substantial recorded output, making it a key contributor to provincial salt volumes.",
    "infanta": "Infanta blends solar and cooked methods; hybrid adoption is increasing to improve grade consistency.",
    "san fabian": "San Fabian's cooked salt remains the mainstay given limited tidal access and indoor processing reliance.",
}


def _build_municipalities(rows, method_by_muni, window):
    if not rows:
        return []
    start, end = window
    municipalities = []
    for r in rows:
        muni_id = r.id
        current_mt = round((r.current_mt or 0), 3)
        previous_mt = round((r.previous_mt or 0), 3) if r.previous_mt is not None else None
        change_pct = None
        if previous_mt:
            change_pct = round(((current_mt - previous_mt) / previous_mt) * 100, 1)

        methods = method_by_muni.get(muni_id, {})
        solar = round((methods.get("solar", 0)), 3)
        cooked = round((methods.get("cooked", 0)), 3)
        hybrid = round((methods.get("hybrid", 0)), 3)
        dominant = None
        if methods:
            dominant = max(
                (("solar", solar), ("cooked", cooked), ("hybrid", hybrid)),
                key=lambda x: x[1],
            )[0]

        municipalities.append({
            "id": muni_id,
            "name": r.name,
            "latitude": float(r.latitude),
            "longitude": float(r.longitude),
            "productionMT": current_mt,
            "previousProductionMT": previous_mt,
            "productionChangePercent": change_pct,
            "productionAreaSqm": None,
            "saltBeds": int(round(float(r.current_beds or 0))),
            "saltBedsValue": (
                float(r.current_beds) if r.current_beds is not None else None
            ),
            "saltBedsYear": r.salt_beds_year,
            "saltBedsConfidence": r.salt_beds_confidence,
            "dominantMethod": dominant,
            "solarProductionMT": solar,
            "cookedProductionMT": cooked,
            "hybridProductionMT": hybrid,
            "insightSnippet": INSIGHTS.get(normalized_name(r.name)),
            "geojsonRef": r.geojson_ref,
            "historicalProduction": _historical(muni_id),
            "dataSource": "municipality_production",
        })

    # Assign production ranks by current productionMT (descending).
    ordered = sorted(municipalities, key=lambda m: m["productionMT"], reverse=True)
    for idx, m in enumerate(ordered, start=1):
        m["productionRank"] = idx
    return municipalities


def _historical(municipality_id):
    rows = (
        db.session.query(
                MunicipalityMonthlyProduction.production_year.label("year"),
                func.sum(MunicipalityMonthlyProduction.production_kg).label("kg"),
        )
            .filter(MunicipalityMonthlyProduction.municipality_id == municipality_id)
            .group_by(MunicipalityMonthlyProduction.production_year)
            .order_by(MunicipalityMonthlyProduction.production_year)
        .all()
    )
    return {
        int(r.year): round(float(r.kg or 0) / 1000.0, 3)
        for r in rows
    }


@public_api_bp.route("/dashboard", methods=["GET"])
def dashboard():
    # Public production analytics use the source-labeled municipality dataset.
    rows, method_by_muni, window = _municipality_summary()
    municipalities = _build_municipalities(rows, method_by_muni, window)
    return jsonify({
        "municipalities": municipalities,
        "production": _production(),
        "demographics": _demographics(),
        "supplyDemand": _supply_demand(),
        "dataSource": "municipality_production",
        "dataSourceLabel": PRODUCTION_SOURCE_LABEL,
    })


@public_api_bp.route("/municipalities", methods=["GET"])
def municipalities():
    """Active municipality directory for filters and map highlighting.

    Public on purpose: the guest dashboard and the admin filter bar both read
    the same database-managed list, so labels and counts can never drift.
    """
    rows = active_municipalities()
    return jsonify({
        "municipalities": [
            {
                "id": m.id,
                "name": m.name,
                "slug": municipality_slug(m.name),
                "latitude": float(m.latitude),
                "longitude": float(m.longitude),
                "geojsonRef": m.geojson_ref,
            }
            for m in rows
        ],
        "count": len(rows),
    })