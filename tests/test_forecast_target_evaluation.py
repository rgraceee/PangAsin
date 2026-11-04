from types import SimpleNamespace
from unittest.mock import patch

from app.services.forecast_service import evaluate_target


def _projection(total):
    return {
        "evaluation_year": 2026,
        "last_record_month": "2026-06",
        "months_remaining_in_year": 6,
        "ytd_approved": [{"month": "2026-06", "total_mt": total}],
        "ytd_approved_total": total,
        "forecast_months_in_year": 2,
        "target_for_forecast_months": 0,
        "forecast_total_in_year": 0,
        "forecast_lower_in_year": 0,
        "forecast_upper_in_year": 0,
    }


def _evaluate(ytd_total, forecasts):
    labels = [f"2026-{month:02d}" for month in range(7, 7 + len(forecasts))]
    latest_run = SimpleNamespace(expected_change_pct=50)
    with (
        patch("app.services.forecast_service._derive_seasonal_weights", return_value=([1 / 12] * 12, "test")),
        patch("app.services.forecast_service._latest_scope_run", return_value=latest_run),
        patch(
            "app.services.forecast_service._forecast_series",
            return_value=(labels, forecasts, [None] * len(forecasts), [None] * len(forecasts)),
        ),
        patch("app.services.forecast_service._year_projection", return_value=_projection(ytd_total)),
        patch("app.services.forecast_service._trend_direction", return_value="increasing"),
        patch("app.services.forecast_service._target_recommendations", return_value=[]),
    ):
        return evaluate_target(
            municipality_id=1,
            annual_target=50000,
            forecast_horizon=len(forecasts),
            split_method="seasonal",
            target_basis="annual",
        )


def test_target_evaluation_includes_current_supply_and_entire_forecast_horizon():
    result = _evaluate(ytd_total=1000, forecasts=[20000, 30000])

    assert result["total_target"] == 50000
    assert result["total_projected"] == 51000
    assert result["variance"] == 1000
    assert result["achievable"] is True


def test_target_evaluation_reports_shortfall_when_projected_supply_is_insufficient():
    result = _evaluate(ytd_total=1000, forecasts=[10000, 15000])

    assert result["total_target"] == 50000
    assert result["total_projected"] == 26000
    assert result["variance"] == -24000
    assert result["achievable"] is False
