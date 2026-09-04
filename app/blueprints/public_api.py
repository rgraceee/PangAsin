"""Public, unauthenticated endpoints that power the guest dashboard.

These aggregate production records, municipalities, and demand benchmarks
stored in the database (Supabase) into the shape the public React dashboard
expects. No login is required.
"""
from flask import Blueprint, jsonify
from datetime import datetime, date, timedelta
from sqlalchemy import func, case

from app.extensions import db
from app.models.municipality import Municipality
from app.models.production_record import ProductionRecord
from app.models.demand_benchmark import DemandBenchmark
from app.services.forecast_service import _monthly_aggregates

public_api_bp = Blueprint("public_api", __name__, url_prefix="/api/public")

AGE_FIELDS = [
    "producers_18_30",
    "producers_31_40",
    "producers_41_50",
    "producers_51_60",
    "producers_61_plus",
]


def _latest_date():
    return (
        db.session.query(func.max(ProductionRecord.record_date))
        .filter(ProductionRecord.status == "approved")
        .scalar()
    )


def _municipality_summary():
    latest = _latest_date()
    if latest is None:
        return [], {}, {}

    end = latest
    start = end - timedelta(days=365)
    prev_start = start - timedelta(days=365)

    def within(day):
        return ProductionRecord.record_date.between(day - timedelta(days=365), day)

    rows = (
        db.session.query(
            Municipality.id,
            Municipality.name,
            Municipality.latitude,
            Municipality.longitude,
            func.coalesce(func.sum(
                case((ProductionRecord.record_date.between(start, end), ProductionRecord.production_volume), else_=0)
            ), 0).label("current_kg"),
            func.coalesce(func.sum(
                case((ProductionRecord.record_date.between(prev_start, start), ProductionRecord.production_volume), else_=0)
            ), 0).label("previous_kg"),
            func.coalesce(func.sum(
                case((ProductionRecord.record_date.between(start, end), ProductionRecord.num_salt_beds), else_=0)
            ), 0).label("current_beds"),
            func.sum(
                case(
                    (ProductionRecord.record_date.between(start, end),
                     ProductionRecord.num_salt_beds * func.coalesce(ProductionRecord.area_per_salt_bed, 0)),
                    else_=0,
                )
            ).label("current_area_sqm"),
            func.sum(func.coalesce(ProductionRecord.male_producers, 0)).label("male"),
            func.sum(func.coalesce(ProductionRecord.female_producers, 0)).label("female"),
        )
        .join(ProductionRecord, Municipality.id == ProductionRecord.municipality_id)
        .filter(ProductionRecord.status == "approved")
        .group_by(Municipality.id, Municipality.name, Municipality.latitude, Municipality.longitude)
        .all()
    )

    method_rows = (
        db.session.query(
            ProductionRecord.municipality_id,
            ProductionRecord.production_method,
            func.sum(case(
                (ProductionRecord.record_date.between(start, end), ProductionRecord.production_volume),
                else_=0,
            )).label("kg"),
        )
        .filter(ProductionRecord.status == "approved")
        .group_by(ProductionRecord.municipality_id, ProductionRecord.production_method)
        .all()
    )
    method_by_muni = {}
    for muni_id, method, kg in method_rows:
        method_by_muni.setdefault(muni_id, {})[method] = float(kg or 0)

    return rows, method_by_muni, (start, end)


def _demographics():
    rows = (
        db.session.query(
            ProductionRecord.municipality_id,
            func.sum(func.coalesce(ProductionRecord.male_producers, 0)).label("male"),
            func.sum(func.coalesce(ProductionRecord.female_producers, 0)).label("female"),
            *(func.sum(func.coalesce(getattr(ProductionRecord, f), 0)).label(f) for f in AGE_FIELDS),
        )
        .filter(ProductionRecord.status == "approved")
        .group_by(ProductionRecord.municipality_id)
        .all()
    )

    by_municipality = {}
    province = {a: 0 for a in AGE_FIELDS}
    province["male"] = 0
    province["female"] = 0
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

    age_labels = ["18-30", "31-40", "41-50", "51-60", "61+"]
    province_age = {
        label: province[AGE_FIELDS[i]] for i, label in enumerate(age_labels)
    }
    province_gender = {
        "male": province["male"],
        "female": province["female"],
        "notSpecified": 0,
    }
    return {
        "provinceWide": {
            "ageGroups": province_age,
            "genderDistribution": province_gender,
        },
        "byMunicipality": by_municipality,
    }


def _production():
    latest = _latest_date()
    if latest is None:
        return {"provinceTotalMT": 0.0, "records": []}
    start = date(2020, 1, 1)
    labels, values, _ = _monthly_aggregates(None, start, latest)
    records = [
        {"year": int(lbl[:4]), "month": int(lbl[5:7]), "totalMT": round(v / 1000, 2)}
        for lbl, v in zip(labels, values)
    ]
    province_total_mt = round(sum(values) / 1000, 2)
    return {"provinceTotalMT": province_total_mt, "records": records}


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
    pangasinan_local_kg = (
        db.session.query(func.sum(ProductionRecord.production_volume))
        .filter(ProductionRecord.status == "approved")
        .scalar()
        or 0
    )
    pangasinan = {
        "localSupply": round(pangasinan_local_kg / 1000, 2),
        "demandBenchmark": float(provincial.demand_volume) if provincial else None,
        "year": provincial.year if provincial else datetime.utcnow().year,
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
        "asOfDate": "June 30, 2026",
    }


INSIGHTS = {
    3: "Alaminos City's coastal brine flats support sustained solar output; forecast readiness depends on the depth of its record history.",
    2: "Anda enjoys steady coastal brine access and extended dry-season periods that support consistent solar evaporation.",
    4: "Bani relies more heavily on cooked production where open evaporation area is limited and labor is readily available.",
    1: "Bolinao's large coastal tracts and strong north-easterly winds reduce drying time, sustaining high solar output.",
    6: "Dasol shows substantial recorded output, making it a key contributor to provincial salt volumes.",
    7: "Infanta blends solar and cooked methods; hybrid adoption is increasing to improve grade consistency.",
    5: "San Fabian's cooked salt remains the mainstay given limited tidal access and indoor processing reliance.",
}


def _build_municipalities(rows, method_by_muni, window):
    start, end = window
    municipalities = []
    for r in rows:
        muni_id = r.id
        current_mt = round((r.current_kg or 0) / 1000, 2)
        previous_mt = round((r.previous_kg or 0) / 1000, 2) if r.previous_kg is not None else None
        change_pct = None
        if previous_mt:
            change_pct = round(((current_mt - previous_mt) / previous_mt) * 100, 1)

        methods = method_by_muni.get(muni_id, {})
        solar = round((methods.get("solar", 0)) / 1000, 2)
        cooked = round((methods.get("cooked", 0)) / 1000, 2)
        hybrid = round((methods.get("hybrid", 0)) / 1000, 2)
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
            "productionAreaSqm": float(r.current_area_sqm or 0),
            "saltBeds": int(r.current_beds or 0),
            "dominantMethod": dominant,
            "solarProductionMT": solar,
            "cookedProductionMT": cooked,
            "hybridProductionMT": hybrid,
            "insightSnippet": INSIGHTS.get(muni_id),
            "historicalProduction": _historical(muni_id),
        })

    # Assign production ranks by current productionMT (descending).
    ordered = sorted(municipalities, key=lambda m: m["productionMT"], reverse=True)
    for idx, m in enumerate(ordered, start=1):
        m["productionRank"] = idx
    return municipalities


def _historical(municipality_id):
    rows = (
        db.session.query(
            func.extract("year", ProductionRecord.record_date).label("year"),
            func.sum(ProductionRecord.production_volume).label("kg"),
        )
        .filter(
            ProductionRecord.municipality_id == municipality_id,
            ProductionRecord.status == "approved",
        )
        .group_by(func.extract("year", ProductionRecord.record_date))
        .order_by(func.extract("year", ProductionRecord.record_date))
        .all()
    )
    return {int(r.year): round(float(r.kg) / 1000, 1) for r in rows}


@public_api_bp.route("/dashboard", methods=["GET"])
def dashboard():
    rows, method_by_muni, window = _municipality_summary()
    municipalities = _build_municipalities(rows, method_by_muni, window)
    return jsonify({
        "municipalities": municipalities,
        "production": _production(),
        "demographics": _demographics(),
        "supplyDemand": _supply_demand(),
    })