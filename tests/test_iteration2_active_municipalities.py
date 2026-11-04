from datetime import date

from app.extensions import db
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.municipality_production import MunicipalityMonthlyProduction
from app.models.production_record import ProductionRecord
from app.models.producer import Producer
from app.models.user import User
from tests.conftest import create_encoder


def _municipality(name, status="active", latitude=16.0, longitude=120.0):
    municipality = Municipality(
        name=name,
        latitude=latitude,
        longitude=longitude,
        status=status,
        is_salt_producing=True,
        geojson_ref=f"geojson/{name.lower().replace(' ', '')}.json",
    )
    db.session.add(municipality)
    db.session.commit()
    return municipality


def _barangay(municipality, name="Poblacion"):
    barangay = Barangay(municipality_id=municipality.id, name=name)
    db.session.add(barangay)
    db.session.commit()
    return barangay


def _approved_record(municipality, barangay, volume_mt=100):
    record = ProductionRecord(
        municipality_id=municipality.id,
        barangay_id=barangay.id,
        record_date=date(2026, 1, 15),
        production_volume_mt=volume_mt,
        num_salt_beds=10,
        area_per_salt_bed=1,
        registered_producers=2,
        male_producers=1,
        female_producers=1,
        production_method="solar",
        status="approved",
        submitted_by=User.query.filter_by(role="admin").first().id,
    )
    db.session.add(record)
    db.session.commit()
    return record


def _monthly_production(municipality, kg=100000, year=2026, month=1):
    row = MunicipalityMonthlyProduction(
        municipality_id=municipality.id,
        production_year=year,
        production_month=month,
        production_kg=kg,
        source_label="test",
        basis="test",
        is_synthetic=False,
    )
    db.session.add(row)
    db.session.commit()
    return row


def test_admin_stats_excludes_inactive_municipalities(admin_client):
    active = _municipality("Bolinao")
    inactive = _municipality("Anda", status="inactive")
    _approved_record(active, _barangay(active), volume_mt=100)
    _approved_record(inactive, _barangay(inactive), volume_mt=50)

    response = admin_client.get("/api/admin/stats?source=approved_records")

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert [row["municipality_name"] for row in body["by_municipality"]] == ["Bolinao"]
    assert body["total_volume_mt"] == 100.0
    assert body["record_count"] == 1


def test_admin_stats_filters_by_active_municipality_slug(admin_client):
    bolinao = _municipality("Bolinao")
    anda = _municipality("Anda")
    _approved_record(bolinao, _barangay(bolinao), volume_mt=100)
    _approved_record(anda, _barangay(anda), volume_mt=50)

    response = admin_client.get(
        "/api/admin/stats?source=approved_records&municipality=bolinao"
    )

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert [row["municipality_name"] for row in body["by_municipality"]] == ["Bolinao"]
    assert body["total_volume_mt"] == 100.0
    assert body["total_salt_beds"] == 10
    assert body["total_registered_producers"] == 2
    assert body["record_count"] == 1


def test_admin_stats_returns_barangay_chart_data_for_selected_municipality(
    admin_client,
):
    bolinao = _municipality("Bolinao")
    other = _municipality("Anda")
    poblacion = _barangay(bolinao, "Poblacion")
    luciente = _barangay(bolinao, "Luciente 1st")
    _approved_record(bolinao, poblacion, volume_mt=25)
    _approved_record(other, _barangay(other), volume_mt=100)
    db.session.add(
        Producer(
            barangay_id=poblacion.id,
            name="Poblacion Farmer",
            age=35,
            sex="Female",
        )
    )
    db.session.add(
        Producer(
            barangay_id=luciente.id,
            name="Luciente Farmer",
            age=45,
            sex="Male",
        )
    )
    db.session.commit()

    response = admin_client.get(
        "/api/admin/stats?source=approved_records"
        "&municipality=bolinao&year=2026&month=1"
    )

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    municipality = body["by_municipality"][0]
    assert municipality["municipality_name"] == "Bolinao"
    assert municipality["by_barangay"] == [{
        "barangay_id": poblacion.id,
        "barangay": "Poblacion",
        "total_volume_mt": 25.0,
        "record_count": 1,
        "total_area_sqm": 10.0,
        "total_salt_beds": 10,
        "total_registered_producers": 2,
    }]
    assert body["master_list_by_barangay"] == [
        {
            "barangay_id": luciente.id,
            "barangay": "Luciente 1st",
            "municipality_id": bolinao.id,
            "producers": 1,
            "age_bands": {
                "18-30": 0,
                "31-40": 0,
                "41-50": 1,
                "51-60": 0,
                "61+": 0,
            },
            "sex": {"male": 1, "female": 0, "other": 0},
        },
        {
            "barangay_id": poblacion.id,
            "barangay": "Poblacion",
            "municipality_id": bolinao.id,
            "producers": 1,
            "age_bands": {
                "18-30": 0,
                "31-40": 1,
                "41-50": 0,
                "51-60": 0,
                "61+": 0,
            },
            "sex": {"male": 0, "female": 1, "other": 0},
        },
    ]


def test_descriptive_production_trend_can_select_a_year(admin_client):
    bolinao = _municipality("Bolinao")
    anda = _municipality("Anda")
    _monthly_production(bolinao, kg=100_000, year=2024, month=12)
    _monthly_production(bolinao, kg=250_000, year=2025, month=1)
    _monthly_production(bolinao, kg=350_000, year=2025, month=12)
    _monthly_production(bolinao, kg=400_000, year=2026, month=2)
    _monthly_production(anda, kg=800_000, year=2023, month=7)

    response = admin_client.get(
        "/api/admin/analytics/descriptive"
        f"?source=municipality_production&municipality_id={bolinao.id}&year=2025"
    )

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body["available_years"] == [2026, 2025, 2024]
    assert body["selected_year"] == 2025
    assert body["filters"]["year"] == 2025
    assert body["monthly_series"] == [
        {"month": "2025-01", "total_mt": 250.0},
        {"month": "2025-12", "total_mt": 350.0},
    ]


def test_descriptive_production_trend_defaults_to_latest_year_in_scope(admin_client):
    bolinao = _municipality("Bolinao")
    anda = _municipality("Anda")
    _monthly_production(bolinao, kg=100_000, year=2024, month=2)
    _monthly_production(anda, kg=500_000, year=2026, month=3)

    response = admin_client.get(
        "/api/admin/analytics/descriptive"
        f"?source=municipality_production&municipality_id={bolinao.id}"
    )

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body["available_years"] == [2024]
    assert body["selected_year"] == 2024
    assert body["monthly_series"] == [
        {"month": "2024-02", "total_mt": 100.0},
    ]


def test_descriptive_production_trend_rejects_invalid_year(admin_client):
    response = admin_client.get(
        "/api/admin/analytics/descriptive"
        "?source=municipality_production&year=not-a-year"
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "year must be a valid integer."


def test_admin_stats_rejects_unknown_municipality_slug(admin_client):
    response = admin_client.get("/api/admin/stats?municipality=not-a-real-place")

    assert response.status_code == 400
    assert "slug" in response.get_json()["error"]


def test_forecast_run_rejects_inactive_municipality(admin_client):
    inactive = _municipality("Anda", status="inactive")

    response = admin_client.post(
        "/api/admin/forecast/run",
        json={"municipality_id": inactive.id, "forecast_horizon": 6},
    )

    assert response.status_code == 400
    assert "inactive" in response.get_json()["error"]


def test_public_municipality_directory_lists_only_active(client):
    _municipality("Anda", status="inactive")
    _municipality("Bolinao")

    response = client.get("/api/public/municipalities")

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body["count"] == 1
    assert [m["name"] for m in body["municipalities"]] == ["Bolinao"]
    assert body["municipalities"][0]["slug"] == "bolinao"


def test_public_dashboard_hides_inactive_and_keys_insights_by_name(client):
    # Create the inactive municipality first so its id is the old Bolinao id.
    inactive = _municipality("Anda", status="inactive")
    active = _municipality("Bolinao")
    _monthly_production(inactive, kg=50000)
    _monthly_production(active, kg=100000)

    response = client.get("/api/public/dashboard")

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert [m["name"] for m in body["municipalities"]] == ["Bolinao"]
    assert body["municipalities"][0]["productionMT"] == 100.0
    assert "Bolinao" in body["municipalities"][0]["insightSnippet"]
    assert body["production"]["provinceTotalMT"] == 100.0


def test_encoder_of_inactive_municipality_loses_access(client):
    inactive = _municipality("Anda", status="inactive")
    create_encoder(
        email="anda.encoder@example.com",
        municipality_id=inactive.id,
        status="active",
    )

    login = client.post(
        "/api/auth/login",
        json={"email": "anda.encoder@example.com", "password": "encoderpass"},
    )
    assert login.status_code == 200, login.get_json()

    response = client.get("/api/encoder/barangays")

    assert response.status_code == 403
    assert "inactive" in response.get_json()["error"].lower()
