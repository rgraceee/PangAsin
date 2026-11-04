from datetime import date

from app.services.data_quality import _month_window


def test_twelve_month_window_includes_december_of_previous_year():
    assert _month_window(date(2026, 11, 1), 12) == [
        "2025-12",
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
        "2026-10",
        "2026-11",
    ]


def test_six_month_window_is_anchored_to_the_selected_year_end():
    assert _month_window(date(2025, 12, 1), 6) == [
        "2025-07",
        "2025-08",
        "2025-09",
        "2025-10",
        "2025-11",
        "2025-12",
    ]


def test_admin_data_quality_endpoint_uses_requested_year(admin_client):
    current_year = date.today().year
    response = admin_client.get(
        f"/api/admin/data-quality?months=12&year={current_year}"
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["selected_year"] == current_year
    assert len(payload["months"]) == 12
    assert payload["months"][-1] == f"{current_year}-{date.today().month:02d}"


def test_admin_data_quality_endpoint_uses_full_prior_year(admin_client):
    prior_year = date.today().year - 1
    response = admin_client.get(
        f"/api/admin/data-quality?months=12&year={prior_year}"
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["selected_year"] == prior_year
    assert payload["months"][0] == f"{prior_year}-01"
    assert payload["months"][-1] == f"{prior_year}-12"
