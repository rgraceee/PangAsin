from app.models.municipality import Municipality
from app.models.barangay import Barangay
from app.models.user import User
from app.extensions import db
from sqlalchemy import text

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
    "Burgos": [
        "Pilar",
        "Santiago",
        "Bato",
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


def seed_records():
    munis = Municipality.query.all()
    count = 0
    for muni in munis:
        users = User.query.filter_by(municipality_id=muni.id, role="encoder").all()
        if not users:
            continue
        submitter = users[0]
        barangays = (
            Barangay.query.filter_by(municipality_id=muni.id)
            .order_by(Barangay.name)
            .limit(3)
            .all()
        )
        for i, barangay in enumerate(barangays):
            if not barangay:
                continue
            exists = db.session.execute(
                text(
                    "select 1 from production_records "
                    "where municipality_id=:m and barangay_id=:b and record_date='2026-08-01'"
                ),
                {"m": muni.id, "b": barangay.id},
            ).first()
            if exists:
                continue
            volume = 100 + i * 37.5
            beds = 8 + i
            db.session.execute(
                text(
                    "insert into production_records "
                    "(municipality_id, barangay_id, record_date, production_volume, num_salt_beds, "
                    " area_per_salt_bed, registered_producers, male_producers, female_producers, "
                    " production_method, status, submitted_by, submitted_at) "
                    "values (:m, :b, '2026-08-01', :v, :beds, :area, :reg, :male, :female, "
                    " 'solar', 'approved', :uid, now())"
                ),
                {
                    "m": muni.id,
                    "b": barangay.id,
                    "v": volume,
                    "beds": beds,
                    "area": 250 + i * 50,
                    "reg": 12 + i,
                    "male": 7 + i,
                    "female": 5,
                    "uid": submitter.id,
                },
            )
            count += 1
    db.session.commit()
    print(f"Seeded {count} demo production records.")


def seed():
    seed_municipalities()
    seed_barangays()
    seed_users()
    seed_records()