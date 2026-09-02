from datetime import date, timedelta
from app.extensions import db
from app.models.municipality import Municipality


# MOCK_DATA — remove after Friday presentation
def _month_label(base: date, offset: int) -> str:
    y = base.year + (base.month + offset - 1) // 12
    m = (base.month + offset - 1) % 12 + 1
    return f"{y:04d}-{m:02d}"


def _build_points(base: date, months: int, start_val: float, slope: float):
    points = []
    for i in range(months):
        label = _month_label(base, i)
        val = start_val + slope * i
        lower = val * 0.88
        upper = val * 1.12
        points.append({
            "period_label": label,
            "predicted_value": round(val, 2),
            "lower_bound": round(lower, 2),
            "upper_bound": round(upper, 2),
            "is_forecast": False,
        })
    return points


def _build_forecast_points(base: date, months: int, start_val: float, slope: float):
    hist_points = _build_points(base, months, start_val, slope)
    return [
        {
            "period_label": p["period_label"],
            "predicted_value": round(p["predicted_value"], 2),
            "lower_bound": round(p["lower_bound"], 2),
            "upper_bound": round(p["upper_bound"], 2),
            "is_forecast": True,
        }
        for p in hist_points
    ]


MOCK_PROFILES = {
    "Alaminos": {
        "readiness": "ready", "reliability": "high", "trend_direction": "increasing",
        "expected_change_pct": 8.4, "projected_total": 142000,
        "hist_start_val": 3800, "hist_slope": 45, "fc_start_val": 4100, "fc_slope": 55,
    },
    "Anda": {
        "readiness": "ready", "reliability": "high", "trend_direction": "increasing",
        "expected_change_pct": 6.2, "projected_total": 98000,
        "hist_start_val": 2600, "hist_slope": 35, "fc_start_val": 2800, "fc_slope": 40,
    },
    "Bani": {
        "readiness": "ready", "reliability": "moderate", "trend_direction": "declining",
        "expected_change_pct": -8.5, "projected_total": 75000,
        "hist_start_val": 3000, "hist_slope": -35, "fc_start_val": 2600, "fc_slope": -40,
    },
    "Bolinao": {
        "readiness": "ready", "reliability": "high", "trend_direction": "increasing",
        "expected_change_pct": 11.3, "projected_total": 128000,
        "hist_start_val": 3400, "hist_slope": 50, "fc_start_val": 3700, "fc_slope": 60,
    },
    "Burgos": {
        "readiness": "ready", "reliability": "moderate", "trend_direction": "stable",
        "expected_change_pct": 1.8, "projected_total": 45000,
        "hist_start_val": 1600, "hist_slope": 8, "fc_start_val": 1700, "fc_slope": 10,
    },
    "Dasol": {
        "readiness": "ready", "reliability": "moderate", "trend_direction": "increasing",
        "expected_change_pct": 15.7, "projected_total": 62000,
        "hist_start_val": 1500, "hist_slope": 30, "fc_start_val": 1700, "fc_slope": 40,
    },
    "Infanta": {
        "readiness": "limited", "reliability": "low", "trend_direction": "declining",
        "expected_change_pct": -5.2, "projected_total": 58000,
        "hist_start_val": 2400, "hist_slope": -25, "fc_start_val": 2200, "fc_slope": -30,
    },
}


def generate_mock_runs(municipality_id=None):
    munis = Municipality.query.filter_by(status="active").order_by(Municipality.name).all()
    if not munis:
        return []

    now = date.today()
    base = date(now.year - 1, now.month, 1)
    hist_months = 6
    fc_months = 12
    total_months = hist_months + fc_months

    runs = []
    for muni in munis:
        if municipality_id is not None and muni.id != municipality_id:
            continue

        profile = MOCK_PROFILES.get(muni.name)
        if not profile:
            continue

        points = []
        points.extend(_build_points(base, hist_months, profile["hist_start_val"], profile["hist_slope"]))
        points.extend(_build_forecast_points(base, fc_months, profile["fc_start_val"], profile["fc_slope"]))

        run = {
            "id": f"mock-{muni.id}",
            "municipality_id": muni.id,
            "municipality_name": muni.name,
            "period_start": base.isoformat(),
            "period_end": _month_label(base, total_months - 1),
            "algorithm": "linear_regression",
            "readiness": profile["readiness"],
            "reliability": profile["reliability"],
            "trend_direction": profile["trend_direction"],
            "expected_change_pct": profile["expected_change_pct"],
            "projected_total": profile["projected_total"],
            "created_at": now.isoformat() + "Z",
            "points": points,
        }
        runs.append(run)

    return runs


def generate_mock_outlook():
    munis = Municipality.query.filter_by(status="active").order_by(Municipality.name).all()
    if not munis:
        return []

    now = date.today()
    outlook = []
    for muni in munis:
        profile = MOCK_PROFILES.get(muni.name)
        if not profile:
            continue
        outlook.append({
            "municipality_id": muni.id,
            "municipality_name": muni.name,
            "trend_direction": profile["trend_direction"],
            "expected_change_pct": profile["expected_change_pct"],
            "readiness": profile["readiness"],
            "reliability": profile["reliability"],
            "last_run_at": now.isoformat() + "Z",
        })
    return outlook
