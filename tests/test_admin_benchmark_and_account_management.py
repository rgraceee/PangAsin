from app.extensions import db
from app.models.demand_benchmark import DemandBenchmark
from app.models.municipality import Municipality
from app.models.municipality_production import MunicipalityMonthlyProduction
from app.models.sector_demand_setting import SectorDemandSetting
from app.models.user import User
from app.services.report_service import build_supply_demand_data


def _municipality(name="Test Municipality", status="active"):
    municipality = Municipality(
        name=name,
        latitude=16.0,
        longitude=120.0,
        status=status,
        is_salt_producing=True,
    )
    db.session.add(municipality)
    db.session.commit()
    return municipality


def _encoder(municipality_id, status="active"):
    encoder = User(
        name="Test Encoder",
        email="encoder@example.com",
        role="encoder",
        municipality_id=municipality_id,
        status=status,
    )
    encoder.set_password("encoderpass")
    db.session.add(encoder)
    db.session.commit()
    return encoder


def test_admin_can_fetch_pangasinan_barangays_from_bundled_psgc_csv(admin_client):
    response = admin_client.get("/api/admin/municipality-barangays?name=Agno")

    assert response.status_code == 200
    body = response.get_json()
    assert body["source"] == "PSGC"
    assert body["municipality_name"] == "Agno"
    assert "Allabon" in body["barangays"]
    assert len(body["barangays"]) == 17


def test_barangay_lookup_requires_admin_authentication(client):
    response = client.get("/api/admin/municipality-barangays?name=Agno")

    assert response.status_code == 401


def test_admin_can_upsert_supply_demand_benchmarks(admin_client):
    municipality = _municipality()
    db.session.add(
        MunicipalityMonthlyProduction(
            municipality_id=municipality.id,
            production_year=2026,
            production_month=1,
            production_kg=16000000,
            source_label="test",
            basis="test",
            is_synthetic=False,
        )
    )
    db.session.commit()
    payload = {
        "geographic_scope": "provincial",
        "year": 2026,
        "demand_volume": "50000.00",
        "local_production": "16000.00",
        "import_volume": "1200.00",
        "source_name": "Test benchmark source",
        "source_reference": "https://example.test/benchmark",
        "notes": "Test values",
    }

    first = admin_client.put("/api/admin/supply-demand/benchmarks", json=payload)
    assert first.status_code == 200, first.get_json()
    assert first.get_json()["benchmark"]["demand_volume"] == 50000.0
    assert first.get_json()["benchmark"]["local_production"] == 16000.0

    payload["demand_volume"] = "51000.25"
    second = admin_client.put("/api/admin/supply-demand/benchmarks", json=payload)
    assert second.status_code == 200, second.get_json()
    assert second.get_json()["benchmark"]["demand_volume"] == 51000.25
    assert DemandBenchmark.query.filter_by(
        year=2026, geographic_scope="provincial"
    ).count() == 1


def test_benchmark_editor_values_are_returned_by_admin_supply_demand(admin_client):
    admin_client.put(
        "/api/admin/supply-demand/benchmarks",
        json={
            "geographic_scope": "national",
            "year": 2026,
            "demand_volume": 600000,
            "local_production": 100000,
            "import_volume": 400000,
            "source_name": "Test source",
        },
    )

    response = admin_client.get("/api/admin/supply-demand")

    assert response.status_code == 200, response.get_json()
    benchmark = response.get_json()["benchmarks"]["national"]
    assert benchmark["year"] == 2026
    assert benchmark["demand_volume"] == 600000.0
    assert benchmark["local_production"] == 100000.0


def test_pangasinan_supply_is_annual_and_uses_production_for_benchmark_year(admin_client):
    municipality = _municipality()
    for year, month, kg in (
        (2025, 1, 1000000),
        (2025, 12, 2500000),
        (2026, 1, 7000000),
    ):
        db.session.add(
            MunicipalityMonthlyProduction(
                municipality_id=municipality.id,
                production_year=year,
                production_month=month,
                production_kg=kg,
                source_label="test",
                basis="test",
                is_synthetic=False,
            )
        )
    db.session.commit()

    response = admin_client.put(
        "/api/admin/supply-demand/benchmarks",
        json={
            "geographic_scope": "provincial",
            "year": 2025,
            "demand_volume": 50000,
            "local_production": 999999,
            "import_volume": 400000,
            "source_name": "Test source",
        },
    )

    assert response.status_code == 200, response.get_json()
    assert response.get_json()["benchmark"]["local_production"] == 3500.0
    payload = admin_client.get("/api/admin/supply-demand").get_json()
    assert payload["pangasinan"]["year"] == 2025
    assert payload["pangasinan"]["local_production"] == 3500.0
    assert payload["benchmarks_by_year"]["provincial"][0]["year"] == 2025
    assert payload["local_supply_by_year"] == {"2025": 3500.0, "2026": 7000.0}


def test_public_supply_uses_the_same_annual_pangasinan_benchmark_year(admin_client):
    municipality = _municipality()
    for year, month, kg in (
        (2025, 1, 1000000),
        (2025, 12, 2500000),
        (2026, 1, 7000000),
    ):
        db.session.add(
            MunicipalityMonthlyProduction(
                municipality_id=municipality.id,
                production_year=year,
                production_month=month,
                production_kg=kg,
                source_label="test",
                basis="test",
                is_synthetic=False,
            )
        )
    db.session.commit()
    admin_client.put(
        "/api/admin/supply-demand/benchmarks",
        json={
            "geographic_scope": "provincial",
            "year": 2025,
            "demand_volume": 50000,
            "source_name": "Test source",
        },
    )

    response = admin_client.get("/api/public/dashboard")

    assert response.status_code == 200
    pangasinan = response.get_json()["supplyDemand"]["pangasinan"]
    assert pangasinan["year"] == 2025
    assert pangasinan["localSupply"] == 3500.0
    assert pangasinan["localSupplyPeriod"] == {"start": "2025-01", "end": "2025-12"}


def test_sector_settings_allocate_current_benchmarks_for_both_scopes(admin_client):
    municipality = _municipality()
    db.session.add_all([
        DemandBenchmark(
            year=2026,
            geographic_scope="national",
            demand_volume=1000,
            local_production=200,
            import_volume=300,
            source_name="National source",
        ),
        DemandBenchmark(
            year=2026,
            geographic_scope="provincial",
            demand_volume=200,
            source_name="Provincial source",
        ),
        MunicipalityMonthlyProduction(
            municipality_id=municipality.id,
            production_year=2026,
            production_month=1,
            production_kg=12000,
            source_label="test",
            basis="test",
            is_synthetic=False,
        ),
    ])
    db.session.commit()

    for scope in ("national", "provincial"):
        response = admin_client.put(
            "/api/admin/supply-demand/sectors",
            json={
                "geographic_scope": scope,
                "sectors": [
                    {"name": "Food", "percentage": 50},
                    {"name": "Others", "percentage": 0},
                ],
            },
        )
        assert response.status_code == 200, response.get_json()

    admin_data = admin_client.get("/api/admin/supply-demand").get_json()
    national_sectors = admin_data["sector_demand_by_scope"]["national"]
    provincial_sectors = admin_data["sector_demand_by_scope"]["provincial"]
    national = next(sector for sector in national_sectors if sector["name"] == "Food")
    provincial = next(sector for sector in provincial_sectors if sector["name"] == "Food")
    national_others = next(sector for sector in national_sectors if sector["name"] == "Others")
    provincial_others = next(sector for sector in provincial_sectors if sector["name"] == "Others")
    assert national == {
        "id": national["id"],
        "name": "Food",
        "percentage": 50.0,
        "demand_mt": 500.0,
        "supply_mt": 250.0,
        "production_mt": 100.0,
    }
    assert provincial["demand_mt"] == 100.0
    assert provincial["supply_mt"] == 6.0
    assert provincial["production_mt"] == 6.0
    assert national_others["percentage"] == 50.0
    assert national_others["demand_mt"] == 500.0
    assert provincial_others["percentage"] == 50.0
    assert provincial_others["demand_mt"] == 100.0

    public_data = admin_client.get("/api/public/dashboard").get_json()
    public_national = public_data["supplyDemand"]["sectorDemandByScope"]["national"]
    public_provincial = public_data["supplyDemand"]["sectorDemandByScope"]["provincial"]
    assert next(sector for sector in public_national if sector["name"] == "Food")["demand_mt"] == 500.0
    assert next(sector for sector in public_provincial if sector["name"] == "Food")["demand_mt"] == 100.0

    updated_target = admin_client.put(
        "/api/admin/supply-demand/benchmarks",
        json={
            "geographic_scope": "national",
            "year": 2026,
            "demand_volume": 1200,
            "local_production": 200,
            "source_name": "Updated national source",
        },
    )
    assert updated_target.status_code == 200
    refreshed = admin_client.get("/api/admin/supply-demand").get_json()
    assert next(
        sector for sector in refreshed["sector_demand_by_scope"]["national"]
        if sector["name"] == "Food"
    )["demand_mt"] == 600.0


def test_sector_percentages_cannot_exceed_100_or_duplicate_names(admin_client):
    first = admin_client.put(
        "/api/admin/supply-demand/sectors",
        json={
            "geographic_scope": "national",
            "sectors": [{"name": "Food", "percentage": 60}],
        },
    )
    assert first.status_code == 200

    overallocated = admin_client.put(
        "/api/admin/supply-demand/sectors",
        json={
            "geographic_scope": "national",
            "sectors": [
                {"name": "Food", "percentage": 60},
                {"name": "Industry", "percentage": 40.01},
            ],
        },
    )
    duplicate = admin_client.put(
        "/api/admin/supply-demand/sectors",
        json={
            "geographic_scope": "national",
            "sectors": [
                {"name": "Food", "percentage": 30},
                {"name": " food ", "percentage": 30},
            ],
        },
    )

    assert overallocated.status_code == 400
    assert "must not exceed 100%" in " ".join(overallocated.get_json()["errors"])
    assert duplicate.status_code == 400
    assert "unique" in " ".join(duplicate.get_json()["errors"])
    settings = SectorDemandSetting.query.filter_by(geographic_scope="national").all()
    assert len(settings) == 2
    percentages = {setting.sector_name: float(setting.percentage) for setting in settings}
    assert percentages == {"Food": 60.0, "Others": 40.0}


def test_supply_demand_report_uses_benchmarks_and_configured_sector_shares(admin_client):
    municipality = _municipality()
    db.session.add_all([
        DemandBenchmark(
            year=2026,
            geographic_scope="national",
            demand_volume=1000,
            local_production=200,
            import_volume=300,
            source_name="National source",
        ),
        DemandBenchmark(
            year=2026,
            geographic_scope="provincial",
            demand_volume=200,
            source_name="Provincial source",
        ),
        MunicipalityMonthlyProduction(
            municipality_id=municipality.id,
            production_year=2026,
            production_month=1,
            production_kg=12000,
            source_label="test",
            basis="test",
            is_synthetic=False,
        ),
        SectorDemandSetting(
            geographic_scope="national",
            sector_name="Food",
            percentage=50,
        ),
    ])
    db.session.commit()

    report = build_supply_demand_data()

    assert report["pangasinan"]["local_production_mt"] == 12.0
    assert report["sector_demand_by_scope"]["national"][0]["demand_mt"] == 500.0
    assert report["sector_demand_by_scope"]["national"][0]["supply_mt"] == 250.0
    assert report["sector_demand_by_scope"]["national"][0]["production_mt"] == 100.0


def test_benchmark_update_rejects_negative_or_overprecision_volumes(admin_client):
    response = admin_client.put(
        "/api/admin/supply-demand/benchmarks",
        json={
            "geographic_scope": "national",
            "year": 2026,
            "demand_volume": -1,
            "local_production": "1.001",
            "source_name": "Test source",
        },
    )

    assert response.status_code == 400
    errors = " ".join(response.get_json()["errors"])
    assert "demand_volume" in errors
    assert "local_production" in errors


def test_admin_can_deactivate_and_reactivate_encoder_accounts(admin_client):
    municipality = _municipality()
    encoder = _encoder(municipality.id)
    session_version = encoder.session_version

    deactivated = admin_client.post(
        f"/api/admin/users/{encoder.id}/deactivate",
        json={"reason": "Account access no longer needed"},
    )
    assert deactivated.status_code == 200, deactivated.get_json()
    db.session.refresh(encoder)
    assert encoder.status == "inactive"
    assert encoder.session_version == session_version + 1

    reactivated = admin_client.post(
        f"/api/admin/users/{encoder.id}/reactivate",
        json={"reason": "Encoder access has been restored"},
    )
    assert reactivated.status_code == 200, reactivated.get_json()
    db.session.refresh(encoder)
    assert encoder.status == "active"
    assert encoder.session_version == session_version + 2


def test_admin_cannot_reactivate_encoder_for_inactive_municipality(admin_client):
    municipality = _municipality(status="inactive")
    encoder = _encoder(municipality.id, status="inactive")

    response = admin_client.post(
        f"/api/admin/users/{encoder.id}/reactivate",
        json={"reason": "Access should be restored"},
    )

    assert response.status_code == 400
    assert "municipality" in response.get_json()["error"].lower()


def test_admin_status_change_requires_a_reason_and_only_targets_encoders(admin_client):
    municipality = _municipality()
    encoder = _encoder(municipality.id)

    missing_reason = admin_client.post(
        f"/api/admin/users/{encoder.id}/deactivate",
        json={"reason": "short"},
    )
    admin_account = User.query.filter_by(role="admin").one()
    forbidden_role = admin_client.post(
        f"/api/admin/users/{admin_account.id}/deactivate",
        json={"reason": "Account access no longer needed"},
    )

    assert missing_reason.status_code == 400
    assert forbidden_role.status_code == 404
