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
        json={"report_type": "production", "format": "excel"},
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
            "report_title": "Production Report",
            "municipalities": [{
                "municipality": "Salt <Research> & Development",
                "production_mt": 10,
            }],
        },
        str(filepath),
    )

    assert filepath.is_file()
    assert filepath.stat().st_size > 0
