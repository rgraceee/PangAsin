from app.extensions import db
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.user import User
from tests.conftest import create_encoder


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


def test_create_municipality_creates_barangays_and_encoder(admin_client):
    response = admin_client.post("/api/admin/municipalities", json=_payload())

    assert response.status_code == 201, response.get_json()
    body = response.get_json()
    municipality = body["municipality"]
    encoder = body["encoder"]

    assert municipality["name"] == "San Fabian"
    assert municipality["geojson_ref"] == "geojson/sanfabian.json"
    assert {b["name"] for b in municipality["barangays"]} == {"Poblacion", "Bolasi"}
    assert encoder["created"] is True
    assert encoder["encoder"]["email"] == "sanfabian.encoder@pangasin.gov.ph"
    assert encoder["encoder"]["must_change_password"] is True
    assert encoder["temporary_password"]

    stored_encoder = User.query.filter_by(email="sanfabian.encoder@pangasin.gov.ph").one()
    assert stored_encoder.role == "encoder"
    assert stored_encoder.status == "active"
    assert stored_encoder.must_change_password is True
    assert stored_encoder.check_password(encoder["temporary_password"])
    assert stored_encoder.password_hash != encoder["temporary_password"]
    assert stored_encoder.name == "Encoder - San Fabian"

    assert Barangay.query.filter_by(municipality_id=municipality["id"]).count() == 2


def test_slug_rules_for_city_names(admin_client):
    response = admin_client.post(
        "/api/admin/municipalities",
        json=_payload(name="Alaminos City", barangays=["Poblacion"]),
    )

    assert response.status_code == 201, response.get_json()
    body = response.get_json()
    assert body["municipality"]["geojson_ref"] == "geojson/alaminos.json"
    assert body["encoder"]["encoder"]["email"] == "alaminos.encoder@pangasin.gov.ph"


def test_duplicate_municipality_name_is_case_insensitive(admin_client):
    assert admin_client.post("/api/admin/municipalities", json=_payload()).status_code == 201

    response = admin_client.post(
        "/api/admin/municipalities",
        json=_payload(name="  san   FABIAN  "),
    )

    assert response.status_code == 409
    assert "already exists" in response.get_json()["error"]


def test_duplicate_encoder_email_returns_conflict(admin_client):
    create_encoder(email="sanfabian.encoder@pangasin.gov.ph")

    response = admin_client.post("/api/admin/municipalities", json=_payload())

    assert response.status_code == 409
    assert "already in use" in response.get_json()["error"]
    assert Municipality.query.filter_by(name="San Fabian").first() is None


def test_slug_collision_with_different_name_returns_conflict(admin_client):
    assert admin_client.post("/api/admin/municipalities", json=_payload()).status_code == 201

    response = admin_client.post(
        "/api/admin/municipalities",
        json=_payload(name="San-Fabian", barangays=["Poblacion"]),
    )

    assert response.status_code == 409


def test_create_validates_all_fields(admin_client):
    response = admin_client.post(
        "/api/admin/municipalities",
        json={
            "name": "",
            "latitude": 91,
            "longitude": 120.1234567,
            "barangays": [],
        },
    )

    assert response.status_code == 400
    errors = " ".join(response.get_json()["errors"])
    assert "name" in errors
    assert "latitude" in errors
    assert "longitude" in errors


def test_create_allows_zero_barangays_for_zero_production_municipality(admin_client):
    response = admin_client.post(
        "/api/admin/municipalities",
        json=_payload(barangays=[]),
    )

    assert response.status_code == 201, response.get_json()
    body = response.get_json()
    assert body["municipality"]["barangays"] == []
    assert body["municipality"]["record_count"] == 0


def test_barangays_are_deduplicated_case_insensitively(admin_client):
    response = admin_client.post(
        "/api/admin/municipalities",
        json=_payload(barangays=["Poblacion", "poblacion", "POBLACION", "Bolasi"]),
    )

    assert response.status_code == 201, response.get_json()
    names = [b["name"] for b in response.get_json()["municipality"]["barangays"]]
    assert names == ["Bolasi", "Poblacion"]


def test_more_than_100_barangays_is_rejected(admin_client):
    response = admin_client.post(
        "/api/admin/municipalities",
        json=_payload(barangays=[f"Barangay {index}" for index in range(101)]),
    )

    assert response.status_code == 400
    assert "at most 100" in " ".join(response.get_json()["errors"])


def test_non_object_json_body_is_rejected(admin_client):
    response = admin_client.post("/api/admin/municipalities", json=["not", "an", "object"])

    assert response.status_code == 400
    assert "JSON object" in " ".join(response.get_json()["errors"])


def test_inactive_municipality_gets_inactive_encoder(admin_client):
    response = admin_client.post(
        "/api/admin/municipalities", json=_payload(status="inactive")
    )

    assert response.status_code == 201, response.get_json()
    encoder = response.get_json()["encoder"]["encoder"]
    assert encoder["status"] == "inactive"
    assert encoder["must_change_password"] is True


def test_update_rename_keeps_encoder_email_and_updates_geojson_ref(admin_client):
    created = admin_client.post("/api/admin/municipalities", json=_payload()).get_json()
    municipality_id = created["municipality"]["id"]

    response = admin_client.patch(
        f"/api/admin/municipalities/{municipality_id}",
        json={"name": "San Fabian Updated"},
    )

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body["municipality"]["name"] == "San Fabian Updated"
    assert body["municipality"]["geojson_ref"] == "geojson/sanfabianupdated.json"

    encoder = User.query.filter_by(municipality_id=municipality_id, role="encoder").one()
    assert encoder.email == "sanfabian.encoder@pangasin.gov.ph"
    assert encoder.name == "Encoder - San Fabian"


def test_update_barangays_is_add_only(admin_client):
    created = admin_client.post("/api/admin/municipalities", json=_payload()).get_json()
    municipality_id = created["municipality"]["id"]

    response = admin_client.patch(
        f"/api/admin/municipalities/{municipality_id}",
        json={"barangays": ["poblacion", "New Barangay"]},
    )

    assert response.status_code == 200, response.get_json()
    names = {b["name"] for b in response.get_json()["municipality"]["barangays"]}
    assert names == {"Poblacion", "Bolasi", "New Barangay"}


def test_deactivation_deactivates_encoders_and_reactivation_does_not_restore(admin_client):
    created = admin_client.post("/api/admin/municipalities", json=_payload()).get_json()
    municipality_id = created["municipality"]["id"]
    encoder = User.query.filter_by(municipality_id=municipality_id, role="encoder").one()

    response = admin_client.patch(
        f"/api/admin/municipalities/{municipality_id}", json={"status": "inactive"}
    )

    assert response.status_code == 200, response.get_json()
    assert response.get_json()["deactivated_encoder_count"] == 1
    assert db.session.get(Municipality, municipality_id).status == "inactive"
    assert db.session.get(User, encoder.id).status == "inactive"

    response = admin_client.patch(
        f"/api/admin/municipalities/{municipality_id}", json={"status": "active"}
    )

    assert response.status_code == 200, response.get_json()
    assert response.get_json()["deactivated_encoder_count"] == 0
    assert db.session.get(Municipality, municipality_id).status == "active"
    assert db.session.get(User, encoder.id).status == "inactive"


def test_update_does_not_change_status_when_omitted(admin_client):
    created = admin_client.post(
        "/api/admin/municipalities", json=_payload(status="inactive")
    ).get_json()
    municipality_id = created["municipality"]["id"]

    response = admin_client.patch(
        f"/api/admin/municipalities/{municipality_id}",
        json={"latitude": 16.2},
    )

    assert response.status_code == 200, response.get_json()
    assert response.get_json()["municipality"]["status"] == "inactive"


def test_non_admin_cannot_manage_municipalities(client):
    create_encoder(email="encoder@example.com", password="encoderpass")
    login = client.post(
        "/api/auth/login",
        json={"email": "encoder@example.com", "password": "encoderpass"},
    )
    assert login.status_code == 200

    assert client.get("/api/admin/municipalities").status_code == 403
    assert client.post("/api/admin/municipalities", json=_payload()).status_code == 403
