import io
import json
import os
from datetime import date

from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.production_record import ProductionRecord
from app.models.user import User
from app.services import geojson_service, municipality_service
from app.services.report_service import build_forecast_data


def _payload(**overrides):
    payload = {
        "name": "San Fabian",
        "latitude": 16.123456,
        "longitude": 120.456789,
        "status": "active",
        "barangays": ["Poblacion", "Bolasi"],
    }
    payload.update(overrides)
    return payload


def _create(client, **overrides):
    response = client.post("/api/admin/municipalities", json=_payload(**overrides))
    assert response.status_code == 201, response.get_json()
    return response.get_json()["municipality"]


def _add_production_record(municipality_id, barangay_id, submitted_by=None):
    if submitted_by is None:
        submitted_by = User.query.filter_by(
            role="encoder", municipality_id=municipality_id
        ).first().id
    record = ProductionRecord(
        municipality_id=municipality_id,
        barangay_id=barangay_id,
        record_date=date(2026, 1, 1),
        production_volume_mt=1,
        num_salt_beds=1,
        area_per_salt_bed=100,
        registered_producers=0,
        male_producers=0,
        female_producers=0,
        producers_18_30=0,
        producers_31_40=0,
        producers_41_50=0,
        producers_51_60=0,
        producers_61_plus=0,
        production_method="solar",
        status="approved",
        submitted_by=submitted_by,
    )
    db.session.add(record)
    db.session.commit()
    return record


# ---------------------------------------------------------------------------
# Known bugs
# ---------------------------------------------------------------------------
def test_create_report_rejects_unknown_municipality(admin_client):
    response = admin_client.post(
        "/api/admin/reports",
        json={
            "report_type": "municipality",
            "format": "pdf",
            "municipality_id": 999999,
        },
    )

    assert response.status_code == 400
    assert "municipality_id is invalid" in response.get_json()["error"]


def test_create_report_rejects_mismatched_barangay(admin_client):
    first = _create(admin_client)
    second = _create(admin_client, name="Bolinao", barangays=["Poblacion"])
    barangay_id = second["barangays"][0]["id"]

    response = admin_client.post(
        "/api/admin/reports",
        json={
            "report_type": "municipality",
            "format": "pdf",
            "municipality_id": first["id"],
            "barangay_id": barangay_id,
        },
    )

    assert response.status_code == 400
    assert "does not belong" in response.get_json()["error"]


def test_forecast_report_data_includes_outlook(app):
    with app.app_context():
        municipality = Municipality(
            name="San Fabian",
            latitude=16.1,
            longitude=120.4,
            geojson_ref="geojson/sanfabian.json",
            status="active",
        )
        db.session.add(municipality)
        db.session.commit()

        data = build_forecast_data()

    assert "runs" in data
    assert "outlook" in data
    assert [row["municipality"] for row in data["outlook"]] == ["San Fabian"]


def test_forecast_report_file_generates_in_every_format(app, tmp_path):
    from app.services.report_service import generate_report_file

    with app.app_context():
        db.session.add(
            Municipality(
                name="San Fabian",
                latitude=16.1,
                longitude=120.4,
                geojson_ref="geojson/sanfabian.json",
                status="active",
            )
        )
        db.session.commit()

        for fmt, extension in (("excel", "xlsx"), ("pdf", "pdf"), ("docx", "docx")):
            filename, filepath, data = generate_report_file(
                "forecast", fmt, reports_dir=str(tmp_path)
            )
            assert filename.endswith(f".{extension}")
            assert os.path.isfile(filepath)
            assert [row["municipality"] for row in data["outlook"]] == ["San Fabian"]


def test_root_route_is_registered_once(app, client):
    root_rules = [rule for rule in app.url_map.iter_rules() if rule.rule == "/"]
    assert len(root_rules) == 1

    response = client.get("/")
    assert response.status_code == 200
    assert b"landing-splash" in response.data


# ---------------------------------------------------------------------------
# Audit logging
# ---------------------------------------------------------------------------
def test_municipality_lifecycle_writes_audit_entries(admin_client, app):
    municipality = _create(admin_client)

    response = admin_client.patch(
        f"/api/admin/municipalities/{municipality['id']}",
        json={"status": "inactive"},
    )
    assert response.status_code == 200

    with app.app_context():
        actions = [
            entry.action
            for entry in AuditLog.query.order_by(AuditLog.id).all()
        ]

    assert "municipality.create" in actions
    assert "municipality.update" in actions

    logs = admin_client.get("/api/admin/audit-logs").get_json()
    assert logs["total"] >= 2
    assert any(item["action"] == "municipality.create" for item in logs["logs"])


def test_user_update_writes_audit_entry(admin_client, app):
    created = _create(admin_client)
    with app.app_context():
        encoder = User.query.filter_by(
            role="encoder", municipality_id=created["id"]
        ).one()
        encoder_id = encoder.id

    response = admin_client.patch(
        f"/api/admin/users/{encoder_id}", json={"status": "inactive"}
    )
    assert response.status_code == 200

    with app.app_context():
        entry = AuditLog.query.filter_by(action="user.update", entity_id=encoder_id).one()
        assert entry.details["changes"]["status"] == {
            "from": "active",
            "to": "inactive",
        }


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
def test_login_rate_limit_returns_429(app, client):
    app.config["LOGIN_RATE_LIMIT"] = 2
    app.config["LOGIN_RATE_WINDOW"] = 60
    app.extensions["rate_limiter"].reset()

    first = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "wrong"},
    )
    second = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "wrong"},
    )
    third = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "wrong"},
    )

    assert first.status_code == 401
    assert second.status_code == 401
    assert third.status_code == 429
    assert third.headers["Retry-After"]
    assert third.get_json()["code"] == "rate_limited"


def test_login_with_overlong_email_is_rejected_and_logged(app, client):
    long_email = f"{'x' * 200}@example.com"

    response = client.post(
        "/api/auth/login",
        json={"email": long_email, "password": "wrong"},
    )

    assert response.status_code == 401
    with app.app_context():
        entry = AuditLog.query.filter_by(action="auth.login.failed").one()
        assert len(entry.actor_email) == 150


# ---------------------------------------------------------------------------
# GeoJSON upload
# ---------------------------------------------------------------------------
def _polygon_file():
    payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "Test"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [120.40, 16.10],
                        [120.41, 16.10],
                        [120.41, 16.11],
                        [120.40, 16.10],
                    ]],
                },
            }
        ],
    }
    return io.BytesIO(json.dumps(payload).encode("utf-8"))


def test_geojson_upload_and_delete(admin_client, app, monkeypatch, tmp_path):
    monkeypatch.setattr(geojson_service, "_geojson_dir", lambda: str(tmp_path))
    municipality = _create(admin_client)
    # Reserved ang geojson_ref kahit wala pang file, kaya false muna dapat.
    assert municipality["has_boundary"] is False

    response = admin_client.post(
        f"/api/admin/municipalities/{municipality['id']}/geojson",
        data={"file": (_polygon_file(), "boundary.geojson")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body["feature_count"] == 1
    assert body["municipality"]["geojson_ref"] == "geojson/sanfabian.json"
    assert body["municipality"]["has_boundary"] is True
    assert (tmp_path / "sanfabian.json").is_file()

    removed = admin_client.delete(
        f"/api/admin/municipalities/{municipality['id']}/geojson"
    )
    assert removed.status_code == 200
    assert removed.get_json()["file_removed"] is True
    assert removed.get_json()["municipality"]["has_boundary"] is False
    assert not (tmp_path / "sanfabian.json").exists()


def test_hard_delete_removes_stored_boundary_file(admin_client, app, monkeypatch, tmp_path):
    monkeypatch.setattr(geojson_service, "_geojson_dir", lambda: str(tmp_path))
    municipality = _create(admin_client)
    uploaded = admin_client.post(
        f"/api/admin/municipalities/{municipality['id']}/geojson",
        data={"file": (_polygon_file(), "boundary.geojson")},
        content_type="multipart/form-data",
    )
    assert uploaded.status_code == 200
    assert (tmp_path / "sanfabian.json").is_file()

    deleted = admin_client.delete(
        f"/api/admin/municipalities/{municipality['id']}",
        json={"confirm_name": municipality["name"]},
    )
    assert deleted.status_code == 200, deleted.get_json()
    assert deleted.get_json()["deleted"]["boundary_file_removed"] is True
    assert not (tmp_path / "sanfabian.json").exists()


def test_rename_moves_uploaded_boundary_file(admin_client, app, monkeypatch, tmp_path):
    monkeypatch.setattr(geojson_service, "_geojson_dir", lambda: str(tmp_path))
    municipality = _create(admin_client)
    uploaded = admin_client.post(
        f"/api/admin/municipalities/{municipality['id']}/geojson",
        data={"file": (_polygon_file(), "boundary.geojson")},
        content_type="multipart/form-data",
    )
    assert uploaded.status_code == 200
    assert (tmp_path / "sanfabian.json").is_file()

    renamed = admin_client.patch(
        f"/api/admin/municipalities/{municipality['id']}",
        json={"name": "San Fabian East"},
    )
    assert renamed.status_code == 200, renamed.get_json()
    assert renamed.get_json()["municipality"]["geojson_ref"] == (
        "geojson/sanfabianeast.json"
    )
    assert (tmp_path / "sanfabianeast.json").is_file()
    assert not (tmp_path / "sanfabian.json").exists()


def test_geojson_upload_rejects_non_polygon(admin_client, app, monkeypatch, tmp_path):
    monkeypatch.setattr(geojson_service, "_geojson_dir", lambda: str(tmp_path))
    municipality = _create(admin_client)
    payload = {"type": "Point", "coordinates": [120.4, 16.1]}

    response = admin_client.post(
        f"/api/admin/municipalities/{municipality['id']}/geojson",
        data={"file": (io.BytesIO(json.dumps(payload).encode()), "point.json")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert "Polygon" in " ".join(response.get_json()["errors"])


# ---------------------------------------------------------------------------
# Barangay lifecycle
# ---------------------------------------------------------------------------
def test_barangay_rename_and_delete(admin_client, app):
    municipality = _create(admin_client)
    barangay = municipality["barangays"][0]

    renamed = admin_client.patch(
        f"/api/admin/barangays/{barangay['id']}",
        json={"name": "Poblacion East"},
    )
    assert renamed.status_code == 200
    assert renamed.get_json()["barangay"]["name"] == "Poblacion East"

    duplicate = admin_client.patch(
        f"/api/admin/barangays/{barangay['id']}",
        json={"name": municipality["barangays"][1]["name"].upper()},
    )
    assert duplicate.status_code == 409

    deleted = admin_client.delete(f"/api/admin/barangays/{barangay['id']}")
    assert deleted.status_code == 200
    with app.app_context():
        assert db.session.get(Barangay, barangay["id"]) is None


def test_barangay_delete_is_blocked_when_records_exist(admin_client, app):
    municipality = _create(admin_client)
    barangay = municipality["barangays"][0]
    with app.app_context():
        _add_production_record(municipality["id"], barangay["id"])

    response = admin_client.delete(f"/api/admin/barangays/{barangay['id']}")

    assert response.status_code == 409
    assert response.get_json()["code"] == "barangay_in_use"
    assert "production record" in response.get_json()["error"]


# ---------------------------------------------------------------------------
# Hard delete
# ---------------------------------------------------------------------------
def test_municipality_hard_delete_requires_name_and_force(admin_client, app):
    municipality = _create(admin_client)
    barangay = municipality["barangays"][0]
    with app.app_context():
        record = _add_production_record(municipality["id"], barangay["id"])
        record_id = record.id
        encoder_id = User.query.filter_by(
            role="encoder", municipality_id=municipality["id"]
        ).one().id

    wrong_name = admin_client.delete(
        f"/api/admin/municipalities/{municipality['id']}",
        json={"confirm_name": "Not the name"},
    )
    assert wrong_name.status_code == 400

    blocked = admin_client.delete(
        f"/api/admin/municipalities/{municipality['id']}",
        json={"confirm_name": municipality["name"]},
    )
    assert blocked.status_code == 409
    assert blocked.get_json()["code"] == "municipality_has_data"

    deleted = admin_client.delete(
        f"/api/admin/municipalities/{municipality['id']}",
        json={"confirm_name": municipality["name"], "force": True},
    )
    assert deleted.status_code == 200, deleted.get_json()

    with app.app_context():
        assert db.session.get(Municipality, municipality["id"]) is None
        assert db.session.get(Barangay, barangay["id"]) is None
        assert db.session.get(User, encoder_id) is None
        assert db.session.get(ProductionRecord, record_id) is None
        assert AuditLog.query.filter_by(action="municipality.delete").count() == 1


def test_hard_delete_detaches_encoder_still_referenced_elsewhere(admin_client, app):
    first = _create(admin_client)
    second = _create(admin_client, name="Bolinao", barangays=["Poblacion"])

    with app.app_context():
        encoder = User.query.filter_by(
            role="encoder", municipality_id=first["id"]
        ).one()
        encoder_id = encoder.id
        # Simulate an encoder whose old rows live in another municipality.
        _add_production_record(
            second["id"], second["barangays"][0]["id"], submitted_by=encoder_id
        )

    deleted = admin_client.delete(
        f"/api/admin/municipalities/{first['id']}",
        json={"confirm_name": first["name"], "force": True},
    )
    assert deleted.status_code == 200, deleted.get_json()
    assert deleted.get_json()["deleted"]["deleted_encoders"] == 0
    assert deleted.get_json()["deleted"]["detached_encoders"] == 1

    with app.app_context():
        kept = db.session.get(User, encoder_id)
        assert kept is not None
        assert kept.municipality_id is None
        assert kept.status == "inactive"
        # The referencing record in the other municipality is untouched.
        assert ProductionRecord.query.filter_by(
            municipality_id=second["id"]
        ).count() == 1


# ---------------------------------------------------------------------------
# Zero-production seeding
# ---------------------------------------------------------------------------
def test_seed_municipalities_dry_run_and_create(admin_client, app, monkeypatch):
    entries = [
        {"name": "Agno", "latitude": 16.1, "longitude": 119.8},
        {"name": "Anda", "latitude": 16.2, "longitude": 119.9},
    ]
    monkeypatch.setattr(
        municipality_service, "load_seed_municipalities", lambda: entries
    )

    dry_run = admin_client.post(
        "/api/admin/municipalities/seed", json={"dry_run": True}
    )
    assert dry_run.status_code == 200
    assert dry_run.get_json()["would_create_count"] == 2
    with app.app_context():
        assert Municipality.query.count() == 0

    created = admin_client.post("/api/admin/municipalities/seed", json={})
    assert created.status_code == 200, created.get_json()
    body = created.get_json()
    assert body["created_count"] == 2
    assert {item["name"] for item in body["created"]} == {"Agno", "Anda"}
    assert all(item["encoder"]["created"] for item in body["created"])

    with app.app_context():
        assert Municipality.query.count() == 2
        assert Barangay.query.count() == 0
