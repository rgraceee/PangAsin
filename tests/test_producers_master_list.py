from app.extensions import db
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.producer import Producer
from app.models.user import User


def test_producer_profile_fields_can_be_saved_and_searched(admin_client):
    municipality = Municipality(
        name="Bolinao",
        latitude=16.391,
        longitude=119.899,
        is_salt_producing=True,
    )
    db.session.add(municipality)
    db.session.flush()
    barangay = Barangay(municipality_id=municipality.id, name="Poblacion")
    second_barangay = Barangay(municipality_id=municipality.id, name="Catuday")
    db.session.add_all([barangay, second_barangay])
    db.session.commit()

    response = admin_client.post(
        "/api/producers",
        json={
            "first_name": "Ana",
            "last_name": "Santos",
            "name": "Ana Santos",
            "age": None,
            "sex": "Female",
            "barangay_id": barangay.id,
            "salt_farm_owner": "Sunrise Salt Farm",
            "designation": "Owner",
            "business_classification": "Individual Producer",
            "contact_number": "09171234567",
            "production_method": "cooked",
            "address": "Poblacion Road",
        },
    )

    assert response.status_code == 201
    producer = response.get_json()
    assert producer["first_name"] == "Ana"
    assert producer["last_name"] == "Santos"
    assert producer["age"] is None
    assert producer["sex"] == "Female"
    assert producer["salt_farm_owner"] == "Sunrise Salt Farm"
    assert producer["designation"] == "Owner"
    assert producer["business_classification"] == "Individual Producer"
    assert producer["contact_number"] == "09171234567"
    assert producer["production_method"] == "cooked"

    other_barangay_producer = admin_client.post(
        "/api/producers",
        json={
            "first_name": "Bea",
            "last_name": "Worker",
            "age": 55,
            "sex": "Female",
            "barangay_id": second_barangay.id,
            "salt_farm_owner": "Catuday Farm",
            "designation": "Salt Maker",
            "business_classification": "Corporation",
            "contact_number": "09170000000",
            "production_method": "solar",
            "address": "Catuday Road",
        },
    )
    assert other_barangay_producer.status_code == 201

    update_response = admin_client.patch(
        f"/api/producers/{producer['id']}",
        json={"first_name": "Ana Maria", "last_name": "Reyes", "age": 35},
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["name"] == "Ana Maria Reyes"

    search_response = admin_client.get("/api/producers", query_string={"q": "09171234567"})
    assert search_response.status_code == 200
    assert [row["id"] for row in search_response.get_json()["producers"]] == [producer["id"]]

    for column, value, expected_ids in (
        ("first_name", "Ana", [producer["id"]]),
        ("last_name", "Reyes", [producer["id"]]),
        ("min_age", "30", [producer["id"], other_barangay_producer.get_json()["id"]]),
        ("max_age", "40", [producer["id"]]),
        ("salt_farm_owner", "Sunrise", [producer["id"]]),
        ("designation", "Owner", [producer["id"]]),
        ("business_classification", "Individual", [producer["id"]]),
        ("contact_number", "1234567", [producer["id"]]),
        ("address", "Poblacion", [producer["id"]]),
        ("production_method", "cooked", [producer["id"]]),
    ):
        filtered = admin_client.get("/api/producers", query_string={column: value})
        assert filtered.status_code == 200, (column, filtered.get_json())
        assert {row["id"] for row in filtered.get_json()["producers"]} == set(expected_ids), column

    scoped_options = admin_client.get(
        "/api/producers",
        query_string={
            "municipality_id": municipality.id,
            "barangay_id": barangay.id,
            "sex": "Female",
        },
    )
    assert scoped_options.status_code == 200
    options = scoped_options.get_json()["filter_options"]
    assert options["salt_farm_owner"] == ["Sunrise Salt Farm"]
    assert options["designation"] == ["Owner"]
    assert options["business_classification"] == ["Individual Producer"]
    assert options["address"] == ["Poblacion Road"]
    assert options["production_method"] == ["cooked"]

    other_barangay_options = admin_client.get(
        "/api/producers",
        query_string={
            "municipality_id": municipality.id,
            "barangay_id": second_barangay.id,
            "sex": "Female",
        },
    )
    assert other_barangay_options.get_json()["filter_options"]["salt_farm_owner"] == ["Catuday Farm"]

    invalid_age_range = admin_client.get(
        "/api/producers",
        query_string={"min_age": "50", "max_age": "40"},
    )
    assert invalid_age_range.status_code == 400
    invalid_method = admin_client.get(
        "/api/producers",
        query_string={"production_method": "steam"},
    )
    assert invalid_method.status_code == 400
    invalid_update = admin_client.patch(
        f"/api/producers/{producer['id']}",
        json={"production_method": "steam"},
    )
    assert invalid_update.status_code == 400


def test_filtered_producer_reports_snapshot_master_list_and_barangay_rows(
    admin_client, app, monkeypatch, tmp_path
):
    from openpyxl import load_workbook
    from io import BytesIO

    municipality = Municipality(
        name="Bolinao",
        latitude=16.391,
        longitude=119.899,
        is_salt_producing=True,
    )
    db.session.add(municipality)
    db.session.flush()
    poblacion = Barangay(municipality_id=municipality.id, name="Poblacion")
    catuday = Barangay(municipality_id=municipality.id, name="Catuday")
    db.session.add_all([poblacion, catuday])
    db.session.flush()
    db.session.add_all([
        Producer(
            name="Ana Santos",
            first_name="Ana",
            last_name="Santos",
            age=35,
            sex="Female",
            barangay_id=poblacion.id,
            salt_farm_owner="Sunrise Salt Farm",
            designation="Owner",
            business_classification="Individual Producer",
            contact_number="09171234567",
            production_method="cooked",
            address="Poblacion Road",
        ),
        Producer(
            name="Bea Worker",
            first_name="Bea",
            last_name="Worker",
            age=55,
            sex="Female",
            barangay_id=catuday.id,
            salt_farm_owner="Catuday Farm",
            designation="Worker",
            business_classification="Corporation",
            contact_number="09170000000",
            production_method="solar",
            address="Catuday Road",
        ),
        Producer(
            name="Carlo Reyes",
            first_name="Carlo",
            last_name="Reyes",
            age=35,
            sex="Male",
            barangay_id=poblacion.id,
            salt_farm_owner="Sunrise Salt Farm",
            designation="Owner",
            business_classification="Individual Producer",
            contact_number="09179999999",
            production_method="solar",
            address="Poblacion Road",
        ),
    ])
    db.session.commit()
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path / "reports"))

    filters = {
        "sex": "Female",
        "age_group": "30to44",
        "min_age": 30,
        "max_age": 40,
        "salt_farm_owner": "Sunrise",
        "production_method": "cooked",
        "q": "Ana",
        "view": "farmers",
    }
    response = admin_client.post(
        "/api/admin/reports",
        json={
            "report_type": "producers",
            "title": "Filtered Salt Farmer Master List",
            "format": "excel",
            "municipality_id": municipality.id,
            "filters": filters,
        },
    )
    assert response.status_code == 201, response.get_json()
    report = response.get_json()["report"]
    expected_rows = admin_client.get(
        "/api/producers",
        query_string={
            "municipality_id": municipality.id,
            "sex": "Female",
            "age_group": "30to44",
            "min_age": 30,
            "max_age": 40,
            "salt_farm_owner": "Sunrise",
            "production_method": "cooked",
            "q": "Ana",
        },
    ).get_json()["producers"]
    assert admin_client.get(
        "/api/producers",
        query_string={
            "municipality_id": municipality.id,
            "sex": "Female",
            "age_group": "30to44",
            "min_age": 30,
            "max_age": 40,
            "salt_farm_owner": "Sunrise",
            "production_method": "cooked",
            "q": "Ana",
        },
    ).get_json()["statistics"]["by_barangay"] == [{
        "barangay": "Poblacion",
        "municipality": "Bolinao",
        "total": 1,
    }]
    assert response.get_json()["data"]["producers"] == [{
        "first_name": expected_rows[0]["first_name"],
        "last_name": expected_rows[0]["last_name"],
        "age": expected_rows[0]["age"],
        "sex": expected_rows[0]["sex"],
        "municipality": expected_rows[0]["municipality"],
        "barangay": expected_rows[0]["barangay"],
        "salt_farm_owner": expected_rows[0]["salt_farm_owner"],
        "designation": expected_rows[0]["designation"],
        "business_classification": expected_rows[0]["business_classification"],
        "contact_number": expected_rows[0]["contact_number"],
        "production_method": expected_rows[0]["production_method"],
        "address": expected_rows[0]["address"],
    }]
    assert report["filters"] == filters

    preview = admin_client.get(f"/api/admin/reports/{report['id']}")
    assert preview.status_code == 200
    assert preview.get_json()["data"] == response.get_json()["data"]

    report_file = tmp_path / "reports" / report["file_url"]
    report_file.write_bytes(b"stale-workbook")
    producer = Producer.query.filter_by(first_name="Ana").one()
    producer.first_name = "Updated"
    db.session.commit()
    download = admin_client.get(f"/api/admin/reports/{report['id']}/download?format=excel")
    assert download.status_code == 200
    workbook = load_workbook(BytesIO(download.data), read_only=True, data_only=True)
    assert workbook.active.title == "Salt Farmer Entries"
    report_rows = list(workbook["Salt Farmer Entries"].values)
    assert report_rows[0][0:4] == ("First Name", "Last Name", "Age", "Sex")
    assert report_rows[1][0:2] == ("Ana", "Santos")

    barangay_response = admin_client.post(
        "/api/admin/reports",
        json={
            "report_type": "producers",
            "title": "Salt Farmers by Barangay",
            "format": "pdf",
            "municipality_id": municipality.id,
            "filters": {**filters, "view": "by_barangay"},
        },
    )
    assert barangay_response.status_code == 201, barangay_response.get_json()
    assert barangay_response.get_json()["data"]["by_barangay"] == [{
        "barangay": "Poblacion",
        "municipality": "Bolinao",
        "total": 1,
    }]


def test_producer_report_accepts_optional_csv_fields(client, app):
    with app.app_context():
        municipality = Municipality(
            name="Infanta",
            latitude=16.0,
            longitude=119.9,
            is_salt_producing=True,
        )
        db.session.add(municipality)
        db.session.flush()
        barangay = Barangay(municipality_id=municipality.id, name="Bayambang")
        encoder = User(
            name="Infanta Encoder",
            email="infanta.encoder@example.com",
            role="encoder",
            municipality_id=municipality.id,
            status="active",
        )
        encoder.set_password("encoderpass")
        db.session.add_all([barangay, encoder])
        db.session.commit()
        barangay_id = barangay.id

    login = client.post(
        "/api/auth/login",
        json={"email": "infanta.encoder@example.com", "password": "encoderpass"},
    )
    assert login.status_code == 200

    response = client.post(
        "/api/encoder/producer-reports",
        json={
            "entries": [{
                "barangay_id": barangay_id,
                "first_name": "Agerico",
                "last_name": "Buaga",
                "age": None,
                "age_bracket": "31-40",
                "sex": None,
                "address": "Bayambang coastal road",
                "salt_farm_owner": "Bayambang Salt Farm",
                "designation": "Caretaker",
                "business_classification": "Individual Producer",
                "contact_number": "09119999999",
                "production_method": "cooked",
            }],
        },
    )

    assert response.status_code == 201
    entry = response.get_json()["entries"][0]
    assert entry["name"] == "Agerico Buaga"
    assert entry["age"] is None
    assert entry["age_bracket"] == "31-40"
    assert entry["sex"] is None
    assert entry["address"] == "Bayambang coastal road"
    assert entry["salt_farm_owner"] == "Bayambang Salt Farm"
    assert entry["contact_number"] == "09119999999"
    assert entry["production_method"] == "cooked"


def test_production_worker_age_counts_cannot_exceed_registered_workers(client, app):
    with app.app_context():
        municipality = Municipality(
            name="Infanta",
            latitude=16.0,
            longitude=119.9,
            is_salt_producing=True,
        )
        db.session.add(municipality)
        db.session.flush()
        barangay = Barangay(municipality_id=municipality.id, name="Bayambang")
        encoder = User(
            name="Infanta Encoder",
            email="worker-count.encoder@example.com",
            role="encoder",
            municipality_id=municipality.id,
            status="active",
        )
        encoder.set_password("encoderpass")
        db.session.add_all([barangay, encoder])
        db.session.commit()
        barangay_id = barangay.id

    login = client.post(
        "/api/auth/login",
        json={"email": "worker-count.encoder@example.com", "password": "encoderpass"},
    )
    assert login.status_code == 200

    payload = {
        "barangay_id": barangay_id,
        "record_date": "2026-11-06",
        "production_volume_mt": 1,
        "num_salt_beds": 1,
        "production_method": "solar",
        "male_producers": 1,
        "female_producers": 1,
        "producers_18_30": 1,
        "producers_31_40": 1,
        "producers_41_50": 1,
        "producers_51_60": 0,
        "producers_61_plus": 0,
    }

    response = client.post("/api/encoder/records", json=payload)
    assert response.status_code == 400
    assert "Age-bracket worker counts (3) cannot exceed registered workers (2)." in response.get_json()["errors"]

    payload["producers_41_50"] = 0
    response = client.post("/api/encoder/records", json=payload)
    assert response.status_code == 201
    assert response.get_json()["registered_producers"] == 2