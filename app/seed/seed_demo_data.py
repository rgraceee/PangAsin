from app.models.municipality import Municipality
from app.models.barangay import Barangay
from app.models.user import User
from app.models.demand_benchmark import DemandBenchmark
from app.extensions import db
from sqlalchemy import text
from datetime import datetime
import random

# Self-contained salt barangay reference data (municipality name -> barangay names).
# Kept inlined here so no runtime code depends on app/data/barangays.py.
SALT_BARANGAYS = {
    "Bolinao": [
        "Victory",
        "Pilar",
        "Zaragoza",
    ],
    "Anda": [
        "Sablig",
        "Macaleeng",
        "Tondol",
    ],
    "Alaminos": [
        "Bolaney",
        "Bisocol",
        "Pangapisan",
        "Mona",
        "Cayucay",
        "Baleyadaan",
        "Lucap",
        "Bued",
        "Sabangan",
        "Pandan",
        "Telbang",
        "Victoria",
    ],
    "Bani": [
        "Banog Norte",
        "San Miguel",
    ],
    "San Fabian": [
        "Tiblong",
        "Bolasi",
        "Longos",
    ],
    "Dasol": [
        "Gais-Guipe",
        "Hermosa",
        "Magsaysay",
        "Malacapas",
        "Amalbalan",
        "Uli",
        "Bobonot",
    ],
    "Infanta": [
        "Bamban",
        "Batang",
        "Bayambang",
        "Cato",
        "Doliman",
        "Fatima",
        "Maya",
        "Nangalisan",
        "Nayom",
        "Pita",
        "Poblacion",
        "Potol",
        "Babuyan",
    ],
}


def seed_municipalities():
    existing = Municipality.query.order_by(Municipality.id).all()
    if existing:
        print(f"{len(existing)} municipalities already present; skipping.")
        return existing
    return []


def seed_barangays():
    munis = Municipality.query.all()
    inserted = 0
    for muni in munis:
        names = SALT_BARANGAYS.get(muni.name, [])
        existing = {b.name for b in Barangay.query.filter_by(municipality_id=muni.id).all()}
        for name in names:
            if name in existing:
                continue
            db.session.add(Barangay(municipality_id=muni.id, name=name))
            existing.add(name)
            inserted += 1
    db.session.commit()
    if inserted:
        print(f"Seeded {inserted} barangays.")
    else:
        print("Barangays already present; no changes.")


def seed_users():
    munis = Municipality.query.order_by(Municipality.id).all()
    if not munis:
        print("No municipalities found; seed municipalities first.")
        return

    admin = User.query.filter_by(role="admin").order_by(User.id).first()
    if admin:
        admin.set_password("admin123")
        print(f"Reset admin password for {admin.email}")
    else:
        admin = User(
            name="ASIN Center Administrator",
            email="admin@pangasin.gov.ph",
            role="admin",
            status="active",
        )
        admin.set_password("admin123")
        db.session.add(admin)
        print("Created admin@pangasin.gov.ph")

    for muni in munis:
        encoded_name = muni.name.lower().replace(" ", ".") + ".encoder@pangasin.gov.ph"
        user = User.query.filter_by(municipality_id=muni.id, role="encoder").first()
        if user is None:
            user = User.query.filter_by(email=encoded_name, role="encoder").first()
        if user is None:
            user = User(
                name=f"Encoder - {muni.name}",
                email=encoded_name,
                role="encoder",
                municipality_id=muni.id,
                status="active",
            )
            user.set_password("encoder123")
            db.session.add(user)
            print(f"Created {encoded_name}")
        else:
            user.set_password("encoder123")
            print(f"Reset encoder password for {user.email}")
    db.session.commit()


# Number of months of approved historical records to generate per barangay for
# municipalities intended to reach forecast readiness ("ready" = >=24 months).
FULL_HISTORY_MONTHS = 28

# Municipality profiles:
#   history_months determines readiness (>=24 -> ready, >=12 -> limited, <12 -> not_ready)
#   base_volume, trend, and seasonality control the month-to-month figures.
MUNI_PROFILES = {
    "Alaminos": {"history_months": 28, "base_volume": 3800.0, "trend": 45.0, "seasonality": 0.35},
    "Anda":     {"history_months": 28, "base_volume": 2600.0, "trend": 32.0, "seasonality": 0.30},
    "Bolinao":  {"history_months": 28, "base_volume": 3400.0, "trend": 40.0, "seasonality": 0.32},
    "Dasol":    {"history_months": 28, "base_volume": 1500.0, "trend": 25.0, "seasonality": 0.28},
    "Bani":     {"history_months": 13, "base_volume": 2700.0, "trend": -20.0, "seasonality": 0.30},
    "Infanta":  {"history_months": 12, "base_volume": 2300.0, "trend": -12.0, "seasonality": 0.28},
    "San Fabian": {"history_months": 6, "base_volume": 1200.0, "trend": 18.0, "seasonality": 0.24},
}

# Seasonality: salt production is higher in the dry season (Mar-Jun), lower
# during the rainy season (Jul-Dec). Multiplier per calendar month.
MONTHLY_SEASONALITY = {
    1: 0.90, 2: 0.95, 3: 1.20, 4: 1.30, 5: 1.25, 6: 1.15,
    7: 0.75, 8: 0.65, 9: 0.70, 10: 0.85, 11: 0.95, 12: 1.00,
}


def seed_records():
    munis = Municipality.query.all()
    count = 0
    generated_months = 0
    for muni in munis:
        users = User.query.filter_by(municipality_id=muni.id, role="encoder").all()
        if not users:
            continue

        existing_count = db.session.execute(
            text("select count(*) from production_records where municipality_id=:m"),
            {"m": muni.id},
        ).scalar()
        if existing_count:
            print(f"{muni.name} already has {existing_count} record(s); skipping history generation.")
            continue

        profile = MUNI_PROFILES.get(muni.name, {"history_months": 28, "base_volume": 2000.0, "trend": 20.0, "seasonality": 0.3})
        submitter = users[0]
        barangay_names = [b.name for b in Barangay.query.filter_by(municipality_id=muni.id).order_by(Barangay.name).limit(3).all()]

        for month_index in range(profile["history_months"]):
            # Anchor the history at the current period (month_index 0 .. N-1 going back).
            months_back = profile["history_months"] - 1 - month_index
            now = datetime.now()
            total_months = now.year * 12 + (now.month - 1) - months_back
            year = total_months // 12
            month_num = total_months % 12 + 1
            record_date = f"{year:04d}-{month_num:02d}-15"

            for i, barangay_name in enumerate(barangay_names):
                # Positive trend grows toward present, negative declines toward present.
                base = profile["base_volume"]
                linear = base + profile["trend"] * month_index
                seasonal = MONTHLY_SEASONALITY.get(month_num, 1.0)
                noise = random.uniform(0.85, 1.15)
                volume = max(50.0, linear * seasonal * noise)

                beds = 8 + i
                area = 250 + i * 50
                reg = 12 + i
                male = 7 + i
                female = 5
                db.session.execute(
                    text(
                        "insert into production_records "
                        "(municipality_id, barangay_id, record_date, production_volume, num_salt_beds, "
                        " area_per_salt_bed, registered_producers, male_producers, female_producers, "
                        " production_method, status, submitted_by, submitted_at) "
                        "values (:m, (select id from barangays where municipality_id=:m and name=:bn limit 1), "
                        " :d, :v, :beds, :area, :reg, :male, :female, 'solar', 'approved', :uid, now())"
                    ),
                    {
                        "m": muni.id,
                        "bn": barangay_name,
                        "d": record_date,
                        "v": round(volume, 2),
                        "beds": beds,
                        "area": area,
                        "reg": reg,
                        "male": male,
                        "female": female,
                        "uid": submitter.id,
                    },
                )
                count += 1
            generated_months += 1
    db.session.commit()
    print(f"Seeded {count} demo production records across {generated_months} generated months.")


def seed_demand_benchmarks():
    seeded = []
    seed_rows = [
        {
            "year": 2026,
            "geographic_scope": "provincial",
            "demand_volume": 50000.0,
            "local_production": 18642.0,
            "import_volume": None,
            "source_name": "DOST NICER / ASIN Center benchmark",
            "source_reference": "Internal benchmark used for the Pangasinan Salt Industry Development Plan.",
            "notes": "Baseline local production figure; the live supply/demand endpoint recomputes it from approved records when available.",
        },
        {
            "year": 2023,
            "geographic_scope": "national",
            "demand_volume": 683608.0,
            "local_production": 114623.0,
            "import_volume": 500000.0,
            "source_name": "Philippine Statistics Authority / industry reference",
            "source_reference": "National salt demand and production estimates (national scope).",
            "notes": "National-level demand, domestic production, and import volumes for comparison.",
        },
    ]
    for row in seed_rows:
        existing = DemandBenchmark.query.filter_by(
            year=row["year"], geographic_scope=row["geographic_scope"]
        ).first()
        if existing:
            continue
        db.session.add(DemandBenchmark(**row))
        seeded.append(f"{row['geographic_scope']} {row['year']}")
    db.session.commit()
    if seeded:
        print(f"Seeded demand benchmarks: {', '.join(seeded)}")
    else:
        print("Demand benchmarks already present; no changes.")


def seed():
    seed_municipalities()
    seed_barangays()
    seed_users()
    seed_records()
    seed_demand_benchmarks()