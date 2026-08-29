import random
from datetime import datetime, timedelta, date
from decimal import Decimal

from app.models.user import User
from app.models.production_record import ProductionRecord
from app.models.submission_batch import SubmissionBatch
from app.models.validation_history import ValidationHistory
from app.models.demand_benchmark import DemandBenchmark
from app.models.forecast_run import ForecastRun
from app.models.forecast_result import ForecastResult
from app.models.report import Report
from app.models.report_file import ReportFile
from app.models.municipality import Municipality
from app.extensions import db

random.seed(42)

METHODS = ["solar_evaporation", "cooked", "hybrid"]
PERIOD_TYPES = ["monthly", "annual", "daily"]
GENDERS = ["male", "female", "other"]

MUNI_PRODUCTION = {
    "Alaminos City": {"base": 1800, "variance": 400},
    "Anda": {"base": 1100, "variance": 300},
    "Bani": {"base": 900, "variance": 250},
    "Bolinao": {"base": 1500, "variance": 350},
    "Dasol": {"base": 600, "variance": 200},
    "Infanta": {"base": 800, "variance": 250},
    "San Fabian": {"base": 500, "variance": 180},
}

BARANGAYS = {
    "Alaminos City": ["Poblacion", "Balayang", "Batang", "Cabalitian"],
    "Anda": ["Bati", "Macalang", "Malokbit", "Poblacion"],
    "Bani": ["Araw", "Cabungan", "Poblacion", "Tugui"],
    "Bolinao": ["Luna", "Patar", "Poblacion", "Saleng"],
    "Dasol": ["Bogabong", "Poblacion", "Tambac", "Uyong"],
    "Infanta": ["Babuyan", "Poblacion", "Punta", "Suloc"],
    "San Fabian": ["Angalacan", "Mabilao", "Poblacion", "Tempra"],
}


def _seasonal_factor(record_date):
    month = record_date.month
    if month in (11, 12, 1, 2, 3, 4):
        return 1.2
    elif month in (5, 6, 10):
        return 1.0
    else:
        return 0.7


def _rand_date(year, month):
    day = random.randint(1, 28)
    return date(year, month, day)


def seed():
    admin_email = "admin@asin.edu"
    admin = User.query.filter_by(email=admin_email).first()
    if not admin:
        admin = User(name="ASIN Admin", email=admin_email, role="admin", status="active")
        admin.set_password("admin123")
        db.session.add(admin)
        db.session.flush()

    encoders = {}
    for muni_name in MUNI_PRODUCTION:
        email = f"encoder@{muni_name.lower().replace(' ', '')}.edu"
        encoder = User.query.filter_by(email=email).first()
        if not encoder:
            muni = Municipality.query.filter_by(name=muni_name).first()
            encoder = User(
                name=f"{muni_name} Encoder",
                email=email,
                role="encoder",
                municipality_id=muni.id,
                status="active",
            )
            encoder.set_password("encoder123")
            db.session.add(encoder)
            db.session.flush()
        encoders[muni_name] = encoder

    db.session.commit()

    if ProductionRecord.query.count() > 0:
        print("Production records already exist. Skipping demo data seed.")
        return

    records = []
    batches = []

    for muni_name, config in MUNI_PRODUCTION.items():
        muni = Municipality.query.filter_by(name=muni_name).first()
        encoder = encoders[muni_name]
        barangays = BARANGAYS[muni_name]

        batch = SubmissionBatch(
            municipality_id=muni.id,
            uploaded_by=encoder.id,
            original_filename=f"{muni_name}_bulk_upload.xlsx",
            total_rows=0,
            valid_rows=0,
            invalid_rows=0,
            status="completed",
            processed_at=datetime.utcnow() - timedelta(days=15),
        )
        db.session.add(batch)
        db.session.flush()
        batches.append(batch)

        monthly_records = []
        for year in (2023, 2024, 2025):
            for month in range(1, 13):
                if year == 2025 and month > 6:
                    continue
                base = config["base"] * _seasonal_factor(date(year, month, 1))
                volume = Decimal(str(round(base + random.uniform(-config["variance"], config["variance"]), 2)))
                area = Decimal(str(round(volume / 300, 2)))
                beds = max(1, int(volume / 80))
                record_date = _rand_date(year, month)

                incomplete = random.random() < 0.1
                status_roll = random.random()
                if status_roll < 0.6:
                    status = "approved"
                elif status_roll < 0.7:
                    status = "pending"
                elif status_roll < 0.8:
                    status = "rejected"
                elif status_roll < 0.9:
                    status = "draft"
                else:
                    status = "approved"

                record = ProductionRecord(
                    municipality_id=muni.id,
                    submission_batch_id=batch.id,
                    barangay=random.choice(barangays) if not incomplete else None,
                    period_type="monthly",
                    record_date=record_date,
                    production_volume=volume,
                    production_method=random.choices(METHODS, weights=[0.7, 0.2, 0.1])[0],
                    production_area=area if not incomplete else None,
                    num_salt_beds=beds if not incomplete else None,
                    producer_age=random.randint(25, 70) if not incomplete else None,
                    producer_gender=random.choice(GENDERS) if not incomplete else None,
                    notes=None,
                    status=status,
                    submitted_by=encoder.id,
                    submitted_at=datetime.utcnow() - timedelta(days=random.randint(1, 180)),
                )
                records.append(record)
                monthly_records.append(record)

        batch.total_rows = len(monthly_records)
        batch.valid_rows = len(monthly_records)
        batch.invalid_rows = 0

    db.session.add_all(records)
    db.session.commit()

    for muni_name in MUNI_PRODUCTION:
        muni = Municipality.query.filter_by(name=muni_name).first()
        muni_records = ProductionRecord.query.filter_by(municipality_id=muni.id).all()
        approved = [r for r in muni_records if r.status == "approved"]
        if len(approved) >= 2:
            for r in approved[:2]:
                vh = ValidationHistory(
                    production_record_id=r.id,
                    previous_status="pending",
                    new_status="approved",
                    action="approved",
                    reviewer_id=admin.id,
                    comment="Approved by ASIN Center.",
                )
                db.session.add(vh)
            for r in approved[2:4]:
                vh = ValidationHistory(
                    production_record_id=r.id,
                    previous_status="pending",
                    new_status="rejected",
                    action="rejected",
                    reviewer_id=admin.id,
                    comment="Incomplete data.",
                )
                db.session.add(vh)
    db.session.commit()

    for year in (2023, 2024):
        db_session = DemandBenchmark(
            year=year,
            geographic_scope="national",
            demand_volume=Decimal(str(500000 + year * 10000)),
            local_production=Decimal(str(350000 + year * 8000)),
            import_volume=Decimal(str(150000 + year * 2000)),
            source_name="PSA Salt Demand Survey",
            source_reference=f"https://psa.gov.ph/salt-demand-{year}",
            notes="Annual national demand benchmark.",
        )
        db.session.add(db_session)
    db.session.commit()

    for muni_name in ["Alaminos City", "Bolinao", "Anda"]:
        muni = Municipality.query.filter_by(name=muni_name).first()
        forecast_run = ForecastRun(
            model_name="linear_regression",
            model_version="1.0",
            municipality_id=muni.id,
            training_start_date=date(2023, 1, 1),
            training_end_date=date(2024, 12, 31),
            parameters={"model": "linear_regression", "periods": 3},
            mae=Decimal("125.50"),
            rmse=Decimal("178.30"),
            mape=Decimal("8.45"),
            r_squared=Decimal("0.82"),
            generated_by=admin.id,
        )
        db.session.add(forecast_run)
        db.session.flush()

        forecast_periods = [date(2025, 7, 1), date(2025, 8, 1), date(2025, 9, 1)]
        for i, period in enumerate(forecast_periods):
            fr = ForecastResult(
                forecast_run_id=forecast_run.id,
                municipality_id=muni.id,
                forecast_period=period,
                forecast_production=Decimal(str(round(1200 + i * 200 + muni.id * 100, 2))),
                lower_bound=Decimal(str(round(1080 + i * 180 + muni.id * 90, 2))),
                upper_bound=Decimal(str(round(1320 + i * 220 + muni.id * 110, 2))),
                trend_direction="increasing",
            )
            db.session.add(fr)

    report = Report(
        report_type="provincial",
        requested_by=admin.id,
        municipality_id=None,
        date_range_start=date(2024, 1, 1),
        date_range_end=date(2024, 12, 31),
        status="generated",
        generated_at=datetime.utcnow() - timedelta(days=5),
    )
    db.session.add(report)
    db.session.flush()

    for fmt in ("pdf", "excel"):
        rf = ReportFile(
            report_id=report.id,
            file_format=fmt,
            file_url=f"/static/reports/report_{report.id}_{fmt}.{fmt}",
        )
        db.session.add(rf)

    db.session.commit()
    print("Seeded comprehensive demo data.")


if __name__ == "__main__":
    from app import create_app
    from app.extensions import db

    app = create_app()
    with app.app_context():
        seed()
