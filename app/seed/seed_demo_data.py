from app.models.user import User
from app.models.production_record import ProductionRecord
from app.models.forecast_snapshot import ForecastSnapshot
from app.models.municipality import Municipality
from app.extensions import db
from datetime import datetime, timedelta

# TODO: replace with real data — these are placeholder records for skeleton testing


def seed():
    admin_email = "admin@asin.edu"
    admin = User.query.filter_by(email=admin_email).first()
    if not admin:
        admin = User(
            name="ASIN Admin",
            email=admin_email,
            role="admin",
            status="active",
        )
        admin.set_password("admin123")
        db.session.add(admin)

    encoder1_email = "encoder1@asin.edu"
    encoder1 = User.query.filter_by(email=encoder1_email).first()
    if not encoder1:
        encoder1 = User(
            name="Alaminos Encoder",
            email=encoder1_email,
            role="encoder",
            status="active",
        )
        encoder1.set_password("encoder123")
        db.session.add(encoder1)

    encoder2_email = "encoder2@asin.edu"
    encoder2 = User.query.filter_by(email=encoder2_email).first()
    if not encoder2:
        encoder2 = User(
            name="Bolinao Encoder",
            email=encoder2_email,
            role="encoder",
            status="active",
        )
        encoder2.set_password("encoder123")
        db.session.add(encoder2)

    db.session.commit()

    alaminos = Municipality.query.filter_by(name="Alaminos City").first()
    bolinao = Municipality.query.filter_by(name="Bolinao").first()
    bani = Municipality.query.filter_by(name="Bani").first()

    if encoder1 and not encoder1.municipality_id:
        encoder1.municipality_id = alaminos.id
    if encoder2 and not encoder2.municipality_id:
        encoder2.municipality_id = bolinao.id
    db.session.commit()

    if ProductionRecord.query.count() == 0:
        records = [
            ProductionRecord(
                municipality_id=alaminos.id,
                submitted_by=encoder1.id,
                period_type="monthly",
                record_date=datetime(2024, 1, 1).date(),
                barangay="Poblacion",
                production_volume=1200.50,
                production_method="solar_evaporation",
                production_area=5.0,
                num_salt_beds=20,
                producer_age=45,
                producer_gender="Male",
                status="approved",
                submitted_at=datetime.utcnow() - timedelta(days=30),
                reviewed_by=admin.id,
                reviewed_at=datetime.utcnow() - timedelta(days=25),
            ),
            ProductionRecord(
                municipality_id=alaminos.id,
                submitted_by=encoder1.id,
                period_type="monthly",
                record_date=datetime(2024, 2, 1).date(),
                barangay="Poblacion",
                production_volume=1350.75,
                production_method="solar_evaporation",
                production_area=5.5,
                num_salt_beds=22,
                producer_age=50,
                producer_gender="Male",
                status="pending",
                submitted_at=datetime.utcnow() - timedelta(days=10),
            ),
            ProductionRecord(
                municipality_id=bolinao.id,
                submitted_by=encoder2.id,
                period_type="annual",
                record_date=datetime(2024, 1, 1).date(),
                barangay="Luna",
                production_volume=8000.00,
                production_method="cooked",
                production_area=12.0,
                num_salt_beds=45,
                producer_age=38,
                producer_gender="Female",
                status="approved",
                submitted_at=datetime.utcnow() - timedelta(days=60),
                reviewed_by=admin.id,
                reviewed_at=datetime.utcnow() - timedelta(days=55),
            ),
            ProductionRecord(
                municipality_id=bani.id,
                submitted_by=encoder1.id,
                period_type="daily",
                record_date=datetime(2024, 6, 15).date(),
                barangay="Araw",
                production_volume=150.25,
                production_method="hybrid",
                production_area=1.5,
                num_salt_beds=8,
                producer_age=55,
                producer_gender="Male",
                status="rejected",
                reviewer_comment="Volume seems inconsistent with area.",
                reviewed_by=admin.id,
                reviewed_at=datetime.utcnow() - timedelta(days=5),
                submitted_at=datetime.utcnow() - timedelta(days=10),
            ),
            ProductionRecord(
                municipality_id=alaminos.id,
                submitted_by=encoder1.id,
                period_type="monthly",
                record_date=datetime(2024, 3, 1).date(),
                barangay="Poblacion",
                production_volume=1100.00,
                production_method="solar_evaporation",
                production_area=4.8,
                num_salt_beds=19,
                status="returned",
                reviewer_comment="Missing producer age.",
                reviewed_by=admin.id,
                reviewed_at=datetime.utcnow() - timedelta(days=3),
                submitted_at=datetime.utcnow() - timedelta(days=8),
            ),
        ]

        for r in records:
            db.session.add(r)

    if ForecastSnapshot.query.count() == 0:
        snap1 = ForecastSnapshot(
            municipality_id=alaminos.id,
            generated_at=datetime.utcnow() - timedelta(days=5),
            model_version="stub-v0",
            forecast_production=15000.00,
            growth_rate=3.5,
            trend_direction="increasing",
            production_capacity_forecast=16000.00,
        )
        snap2 = ForecastSnapshot(
            municipality_id=bolinao.id,
            generated_at=datetime.utcnow() - timedelta(days=3),
            model_version="stub-v0",
            forecast_production=20000.00,
            growth_rate=6.2,
            trend_direction="increasing",
            production_capacity_forecast=22000.00,
        )
        db.session.add(snap1)
        db.session.add(snap2)

    db.session.commit()
    print("Seeded demo users, records, and forecast snapshots.")
