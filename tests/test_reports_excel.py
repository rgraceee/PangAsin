from openpyxl import load_workbook

from app.services.report_service import write_excel, write_pdf


def test_excel_export_includes_supply_and_sector_demand_sheets(tmp_path):
    filepath = tmp_path / "supply-demand.xlsx"
    write_excel(
        {
            "report_title": "Supply & Demand Report",
            "pangasinan": {
                "year": 2026,
                "demand_volume_mt": 500,
                "local_production_mt": 125,
            },
            "philippines": {
                "year": 2026,
                "demand_volume_mt": 1000,
            },
            "sector_demand_by_scope": {
                "national": [{
                    "id": 1,
                    "name": "Household",
                    "percentage": 40,
                    "demand_mt": 400,
                    "supply_mt": 250,
                    "production_mt": 100,
                }],
                "provincial": [{
                    "id": 2,
                    "name": "Household",
                    "percentage": 40,
                    "demand_mt": 200,
                    "supply_mt": 50,
                    "production_mt": 50,
                }],
            },
        },
        str(filepath),
    )

    workbook = load_workbook(filepath, read_only=True, data_only=True)
    assert "Supply and Demand" in workbook.sheetnames
    assert "Sector Demand" in workbook.sheetnames
    sector_rows = list(workbook["Sector Demand"].values)
    assert sector_rows[0] == (
        "Scope",
        "ID",
        "Name",
        "Percentage (%)",
        "Demand (Metric Tons (MT))",
        "Supply (Metric Tons (MT))",
        "Production (Metric Tons (MT))",
    )
    assert sector_rows[1][0:4] == ("national", 1, "Household", 40)
    assert sector_rows[2][0:4] == ("provincial", 2, "Household", 40)


def test_salt_farmer_master_list_opens_on_filtered_entries(tmp_path):
    filepath = tmp_path / "salt-farmers.xlsx"
    write_excel(
        {
            "report_title": "My Filtered Salt Farmer List",
            "report_view": "farmers",
            "producers": [{
                "first_name": "Ana",
                "last_name": "Santos",
                "age": 35,
                "sex": "Female",
                "municipality": "Bolinao",
                "barangay": "Poblacion",
                "salt_farm_owner": "Sunrise Salt Farm",
                "designation": "Owner",
                "business_classification": "Individual Producer",
                "contact_number": "09171234567",
                "address": "Poblacion Road",
            }],
        },
        str(filepath),
    )

    workbook = load_workbook(filepath, read_only=True, data_only=True)
    assert workbook.active.title == "Salt Farmer Entries"
    rows = list(workbook.active.values)
    assert rows[0] == (
        "First Name",
        "Last Name",
        "Age",
        "Sex",
        "Municipality",
        "Barangay",
        "Salt Farm Owner",
        "Designation",
        "Business Classification",
        "Contact Number",
        "Address",
    )
    assert rows[1][0:4] == ("Ana", "Santos", 35, "Female")
    assert load_workbook(filepath, read_only=True, data_only=True)["Summary"]["A1"].value == "My Filtered Salt Farmer List"


def test_custom_report_title_is_saved_and_used_for_preview_and_export(
    admin_client, monkeypatch, tmp_path
):
    from io import BytesIO

    reports_dir = tmp_path / "reports"
    monkeypatch.setenv("REPORTS_DIR", str(reports_dir))

    response = admin_client.post(
        "/api/admin/reports",
        json={
            "report_type": "producers",
            "format": "excel",
            "title": "Bolinao Female Salt Farmers",
            "filters": {"view": "farmers", "sex": "Female"},
        },
    )
    assert response.status_code == 201, response.get_json()
    report = response.get_json()["report"]
    assert report["title"] == "Bolinao Female Salt Farmers"
    assert response.get_json()["data"]["report_title"] == "Bolinao Female Salt Farmers"

    preview = admin_client.get(f"/api/admin/reports/{report['id']}")
    assert preview.status_code == 200
    assert preview.get_json()["data"]["report_title"] == "Bolinao Female Salt Farmers"

    download = admin_client.get(f"/api/admin/reports/{report['id']}/download?format=excel")
    assert download.status_code == 200
    workbook = load_workbook(BytesIO(download.data), read_only=True, data_only=True)
    assert workbook.active.title == "Salt Farmer Entries"
    assert workbook["Summary"]["A1"].value == "Bolinao Female Salt Farmers"

    pdf_download = admin_client.get(f"/api/admin/reports/{report['id']}/download?format=pdf")
    assert pdf_download.status_code == 200
    assert pdf_download.data.startswith(b"%PDF")

    docx_download = admin_client.get(f"/api/admin/reports/{report['id']}/download?format=docx")
    assert docx_download.status_code == 400

    docx_create = admin_client.post(
        "/api/admin/reports",
        json={
            "report_type": "producers",
            "format": "docx",
            "title": "Bolinao Female Salt Farmers",
        },
    )
    assert docx_create.status_code == 400


def test_report_title_must_be_nonempty_valid_and_at_most_100_characters(admin_client):
    for title in ("  ", "x" * 101, "Invalid\u0001Title"):
        response = admin_client.post(
            "/api/admin/reports",
            json={"report_type": "gis", "format": "excel", "title": title},
        )
        assert response.status_code == 400
    missing = admin_client.post(
        "/api/admin/reports",
        json={"report_type": "gis", "format": "excel"},
    )
    assert missing.status_code == 400


def test_report_preview_validates_content_filters_without_saving_a_report(
    admin_client, monkeypatch
):
    from app.blueprints import reports_api
    from app.models.report import Report

    calls = []

    def build_preview(report_type, municipality_id, barangay_id, start, end, filters=None):
        calls.append((report_type, filters))
        return {"report_title": f"{report_type} preview"}

    monkeypatch.setattr(reports_api, "build_report_data", build_preview)
    starting_report_count = Report.query.count()

    requests = [
        {
            "report_type": "production",
            "filters": {
                "production_method": "solar",
                "min_production_volume_mt": "2.5",
                "max_num_salt_beds": "10",
            },
        },
        {
            "report_type": "environment",
            "filters": {
                "production_method": "hybrid",
                "min_production_area_size": "15",
            },
        },
        {
            "report_type": "producers",
            "filters": {"view": "farmers", "first_name": "Ana"},
        },
    ]
    for payload in requests:
        response = admin_client.post("/api/admin/reports/preview", json=payload)
        assert response.status_code == 200, response.get_json()
        assert response.get_json()["data"]["report_title"] == f"{payload['report_type']} preview"

    assert calls == [
        ("production", {
            "production_method": "solar",
            "min_production_volume_mt": 2.5,
            "max_num_salt_beds": 10.0,
        }),
        ("environment", {
            "production_method": "hybrid",
            "min_production_area_size": 15.0,
        }),
        ("producers", {"view": "farmers", "first_name": "Ana"}),
    ]
    assert Report.query.count() == starting_report_count

    invalid = admin_client.post(
        "/api/admin/reports/preview",
        json={"report_type": "production", "filters": {"unknown_column": "value"}},
    )
    assert invalid.status_code == 400


def test_report_filter_suggestions_are_column_specific_and_scope_aware(admin_client):
    from datetime import date, datetime

    from app.extensions import db
    from app.models.barangay import Barangay
    from app.models.environment_report import EnvironmentReport
    from app.models.municipality import Municipality
    from app.models.production_record import ProductionRecord
    from app.models.producer import Producer
    from app.models.user import User

    municipality = Municipality(name="Suggestion Municipality", latitude=16, longitude=120)
    other_municipality = Municipality(name="Other Municipality", latitude=16, longitude=120)
    db.session.add_all([municipality, other_municipality])
    db.session.flush()
    barangay = Barangay(municipality_id=municipality.id, name="Suggestion Barangay")
    other_barangay = Barangay(municipality_id=other_municipality.id, name="Other Barangay")
    db.session.add_all([barangay, other_barangay])
    db.session.flush()
    admin = User.query.filter_by(email="admin@example.com").first()
    db.session.add_all([
        Producer(
            name="Ana Santos",
            first_name="Ana",
            last_name="Santos",
            barangay_id=barangay.id,
            production_method="cooked",
        ),
        Producer(
            name="Annie Other",
            first_name="Annie",
            last_name="Other",
            barangay_id=other_barangay.id,
            production_method="solar",
        ),
        Producer(
            name="Synthetic Worker 0001",
            barangay_id=barangay.id,
        ),
        ProductionRecord(
            municipality_id=municipality.id,
            barangay_id=barangay.id,
            record_date=date(2026, 1, 15),
            production_volume_mt=12.5,
            num_salt_beds=2,
            registered_producers=1,
            male_producers=0,
            female_producers=1,
            submitted_by=admin.id,
            status="approved",
            production_method="cooked",
        ),
        EnvironmentReport(
            municipality_id=municipality.id,
            barangay_id=barangay.id,
            num_salt_beds=2,
            area_per_salt_bed=10,
            production_methods=["cooked", "solar"],
            production_area_size=20,
            submitted_by=admin.id,
            status="approved",
            submitted_at=datetime(2026, 1, 15),
        ),
    ])
    db.session.commit()

    farmer_suggestions = admin_client.get(
        "/api/admin/reports/suggestions?report_type=producers&field=first_name&q=An"
        f"&municipality_id={municipality.id}"
    )
    assert farmer_suggestions.status_code == 200
    assert farmer_suggestions.get_json()["suggestions"] == ["Ana"]

    middle_match_suggestions = admin_client.get(
        "/api/admin/reports/suggestions?report_type=producers&field=last_name&q=tos"
        f"&municipality_id={municipality.id}"
    )
    assert middle_match_suggestions.status_code == 200
    assert middle_match_suggestions.get_json()["suggestions"] == ["Santos"]

    fallback_last_name_suggestions = admin_client.get(
        "/api/admin/reports/suggestions?report_type=producers&field=last_name&q=0"
        f"&municipality_id={municipality.id}"
    )
    assert fallback_last_name_suggestions.status_code == 200
    assert fallback_last_name_suggestions.get_json()["suggestions"] == ["Worker 0001"]

    fallback_name_preview = admin_client.post(
        "/api/admin/reports/preview",
        json={
            "report_type": "producers",
            "filters": {
                "last_name": "Worker 0001",
                "view": "farmers",
            },
        },
    )
    assert fallback_name_preview.status_code == 200, fallback_name_preview.get_json()
    assert [
        row["last_name"]
        for row in fallback_name_preview.get_json()["data"]["producers"]
    ] == ["Worker 0001"]

    initial_farmer_suggestions = admin_client.get(
        "/api/admin/reports/suggestions?report_type=producers&field=first_name"
        f"&municipality_id={municipality.id}"
    )
    assert initial_farmer_suggestions.status_code == 200
    assert initial_farmer_suggestions.get_json()["suggestions"] == ["Ana", "Synthetic"]

    production_suggestions = admin_client.get(
        "/api/admin/reports/suggestions?report_type=production"
        "&field=min_production_volume_mt&q=12"
        f"&municipality_id={municipality.id}&date_range_start=2026-01-01"
    )
    assert production_suggestions.status_code == 200
    assert production_suggestions.get_json()["suggestions"] == ["12.50000"]

    environment_suggestions = admin_client.get(
        "/api/admin/reports/suggestions?report_type=environment"
        "&field=production_method&q=cooked"
        f"&municipality_id={municipality.id}"
    )
    assert environment_suggestions.status_code == 200
    assert environment_suggestions.get_json()["suggestions"] == ["cooked"]

    invalid_field = admin_client.get(
        "/api/admin/reports/suggestions?report_type=production&field=unknown&q=x"
    )
    assert invalid_field.status_code == 400


def test_production_report_content_filters_apply_before_aggregation(app):
    from datetime import date

    from app.extensions import db
    from app.models.barangay import Barangay
    from app.models.municipality import Municipality
    from app.models.production_record import ProductionRecord
    from app.models.user import User
    from app.services.report_service import build_report_data

    municipality = Municipality(
        name="Filter Test Municipality",
        latitude=16,
        longitude=120,
    )
    db.session.add(municipality)
    db.session.flush()
    barangay = Barangay(municipality_id=municipality.id, name="Filter Test Barangay")
    db.session.add(barangay)
    db.session.flush()
    admin = User.query.filter_by(email="admin@example.com").one()
    db.session.add_all([
        ProductionRecord(
            municipality_id=municipality.id,
            barangay_id=barangay.id,
            record_date=date(2026, 1, 15),
            production_volume_mt=2.5,
            num_salt_beds=3,
            area_per_salt_bed=10,
            registered_producers=4,
            male_producers=2,
            female_producers=2,
            production_method="solar",
            status="approved",
            submitted_by=admin.id,
        ),
        ProductionRecord(
            municipality_id=municipality.id,
            barangay_id=barangay.id,
            record_date=date(2026, 1, 20),
            production_volume_mt=7.5,
            num_salt_beds=5,
            area_per_salt_bed=20,
            registered_producers=8,
            male_producers=4,
            female_producers=4,
            production_method="cooked",
            status="approved",
            submitted_by=admin.id,
        ),
    ])
    db.session.commit()

    data = build_report_data(
        "production",
        municipality.id,
        None,
        date(2026, 1, 1),
        date(2026, 1, 31),
        filters={
            "production_method": "solar",
            "min_production_volume_mt": 2,
            "max_num_salt_beds": 3,
        },
    )

    assert data["by_barangay"] == [{
        "barangay": "Filter Test Barangay",
        "production_mt": 2.5,
        "record_count": 1,
        "total_salt_beds": 3,
        "total_area_sqm": 30.0,
    }]


def test_environment_report_content_filters_apply_to_report_rows(app):
    from datetime import date, datetime

    from app.extensions import db
    from app.models.barangay import Barangay
    from app.models.environment_report import EnvironmentReport
    from app.models.municipality import Municipality
    from app.models.user import User
    from app.services.report_service import build_report_data

    municipality = Municipality(
        name="Environment Filter Municipality",
        latitude=16,
        longitude=120,
    )
    db.session.add(municipality)
    db.session.flush()
    barangay = Barangay(municipality_id=municipality.id, name="Environment Filter Barangay")
    db.session.add(barangay)
    db.session.flush()
    admin = User.query.filter_by(email="admin@example.com").one()
    db.session.add_all([
        EnvironmentReport(
            municipality_id=municipality.id,
            barangay_id=barangay.id,
            num_salt_beds=4,
            area_per_salt_bed=10,
            production_methods=["solar"],
            production_area_size=100,
            status="approved",
            submitted_by=admin.id,
            submitted_at=datetime(2026, 1, 15),
        ),
        EnvironmentReport(
            municipality_id=municipality.id,
            barangay_id=barangay.id,
            num_salt_beds=8,
            area_per_salt_bed=20,
            production_methods=["cooked"],
            production_area_size=250,
            status="approved",
            submitted_by=admin.id,
            submitted_at=datetime(2026, 1, 20),
        ),
    ])
    db.session.commit()

    data = build_report_data(
        "environment",
        municipality.id,
        None,
        date(2026, 1, 1),
        date(2026, 1, 31),
        filters={
            "production_method": "cooked",
            "min_num_salt_beds": 5,
            "max_production_area_size": 300,
        },
    )

    assert data["total_reports"] == 1
    assert data["environment_reports"][0]["num_salt_beds"] == 8
    assert data["total_salt_beds"] == 8


def test_excel_report_title_is_written_as_text(tmp_path):
    filepath = tmp_path / "formula-title.xlsx"
    write_excel({"report_title": "=1+2"}, str(filepath))

    workbook = load_workbook(filepath, read_only=False, data_only=False)
    title = workbook["Summary"]["A1"]
    assert title.value == "=1+2"
    assert title.data_type == "s"


def test_excel_report_download_has_xlsx_filename_and_is_deleted(
    admin_client, monkeypatch, tmp_path
):
    from app.blueprints import reports_api

    reports_dir = tmp_path / "reports"
    monkeypatch.setenv("REPORTS_DIR", str(reports_dir))

    def generate_excel(_report_type, _format, **_kwargs):
        source = tmp_path / "temporary.xlsx"
        source.write_bytes(b"excel-workbook")
        return "production.xlsx", str(source), {"report_title": "Production Report"}

    monkeypatch.setattr(reports_api, "generate_report_file", generate_excel)

    response = admin_client.post(
        "/api/admin/reports",
        json={"report_type": "production", "format": "excel", "title": "Production Report"},
    )
    assert response.status_code == 201
    report = response.get_json()["report"]
    assert report["format"] == "excel"
    assert report["file_url"] == f"report_{report['id']}.xlsx"
    assert (reports_dir / report["file_url"]).read_bytes() == b"excel-workbook"

    download = admin_client.get(
        f"/api/admin/reports/{report['id']}/download?format=excel"
    )
    assert download.status_code == 200
    assert download.headers["Content-Disposition"].endswith(".xlsx")
    assert download.data == b"excel-workbook"
    download.close()

    deleted = admin_client.delete(f"/api/admin/reports/{report['id']}")
    assert deleted.status_code == 200
    assert not (reports_dir / report["file_url"]).exists()


def test_pdf_export_handles_user_text_with_markup_characters(tmp_path):
    filepath = tmp_path / "special-text.pdf"
    write_pdf(
        {
            "report_title": "Salt <Farmers> & Production",
            "municipalities": [{
                "municipality": "Salt <Research> & Development",
                "production_mt": 10,
            }],
        },
        str(filepath),
    )

    assert filepath.is_file()
    assert filepath.stat().st_size > 0


def test_encoder_report_access_is_limited_to_assigned_municipality(
    app, client, monkeypatch, tmp_path
):
    from app.blueprints import reports_api
    from app.extensions import db
    from app.models.barangay import Barangay
    from app.models.municipality import Municipality
    from app.models.report import Report
    from app.models.user import User

    municipality = Municipality(name="Encoder Report Municipality", latitude=16, longitude=120)
    other_municipality = Municipality(name="Other Encoder Municipality", latitude=16, longitude=120)
    db.session.add_all([municipality, other_municipality])
    db.session.flush()
    barangay = Barangay(municipality_id=municipality.id, name="Report Barangay")
    other_barangay = Barangay(municipality_id=other_municipality.id, name="Other Report Barangay")
    encoder = User(
        name="Report Encoder",
        email="report-encoder@example.com",
        role="encoder",
        municipality_id=municipality.id,
        status="active",
    )
    encoder.set_password("encoderpass")
    db.session.add_all([barangay, other_barangay, encoder])
    db.session.flush()
    own_report = Report(
        report_type="production",
        requested_by=encoder.id,
        municipality_id=municipality.id,
        format="pdf",
        status="generated",
        title="Local Production",
    )
    other_report = Report(
        report_type="production",
        requested_by=encoder.id,
        municipality_id=other_municipality.id,
        format="pdf",
        status="generated",
        title="Other Municipality Production",
    )
    db.session.add_all([own_report, other_report])
    db.session.commit()

    login_response = client.post(
        "/api/auth/login",
        json={"email": "report-encoder@example.com", "password": "encoderpass"},
    )
    assert login_response.status_code == 200

    options = client.get("/api/admin/reports/encoder-options")
    assert options.status_code == 200
    assert options.get_json()["municipality"] == {
        "id": municipality.id,
        "name": municipality.name,
    }
    assert options.get_json()["barangays"] == [{"id": barangay.id, "name": barangay.name}]

    listed = client.get("/api/admin/reports")
    assert listed.status_code == 200
    assert [report["id"] for report in listed.get_json()["reports"]] == [own_report.id]

    preview_calls = []

    def build_preview(report_type, municipality_id, barangay_id, start, end, filters=None):
        preview_calls.append((report_type, municipality_id, barangay_id))
        return {"report_title": "Scoped preview"}

    monkeypatch.setattr(reports_api, "build_report_data", build_preview)
    local_preview = client.post(
        "/api/admin/reports/preview",
        json={"report_type": "production"},
    )
    assert local_preview.status_code == 200
    assert preview_calls == [("production", municipality.id, None)]

    foreign_preview = client.post(
        "/api/admin/reports/preview",
        json={"report_type": "production", "municipality_id": other_municipality.id},
    )
    assert foreign_preview.status_code == 403
    foreign_create = client.post(
        "/api/admin/reports",
        json={
            "report_type": "production",
            "municipality_id": other_municipality.id,
            "title": "Foreign Municipality Report",
        },
    )
    assert foreign_create.status_code == 403

    province_preview = client.post(
        "/api/admin/reports/preview",
        json={"report_type": "provincial"},
    )
    assert province_preview.status_code == 403

    foreign_suggestions = client.get(
        "/api/admin/reports/suggestions?report_type=production&field=production_method"
        f"&municipality_id={other_municipality.id}"
    )
    assert foreign_suggestions.status_code == 403

    foreign_report = client.get(f"/api/admin/reports/{other_report.id}")
    assert foreign_report.status_code == 404

    reports_dir = tmp_path / "encoder-reports"
    monkeypatch.setenv("REPORTS_DIR", str(reports_dir))

    def generate_report(_report_type, _format, **kwargs):
        assert kwargs["municipality_id"] == municipality.id
        filepath = tmp_path / "encoder-report.pdf"
        filepath.write_bytes(b"scoped report")
        return "encoder-report.pdf", str(filepath), {"report_title": "Scoped report"}

    monkeypatch.setattr(reports_api, "generate_report_file", generate_report)
    generated = client.post(
        "/api/admin/reports",
        json={"report_type": "production", "title": "My Municipality Report"},
    )
    assert generated.status_code == 201
    assert generated.get_json()["report"]["municipality_id"] == municipality.id

    delete_attempt = client.delete(f"/api/admin/reports/{own_report.id}")
    assert delete_attempt.status_code == 403
