# WHAT: Forecast API endpoints (run forecast, list runs, outlook, target eval).
# WHY: Naka-separate para malinaw kung saan ginagawa ang pagsusuri ng forecast.
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.extensions import db
from app.models.forecast import ForecastRun, ForecastPoint
from app.models.municipality import Municipality
from app.services.forecast_service import (
    run_forecast,
    run_forecast_all_municipalities,
    get_municipality_outlook,
    evaluate_target,
)
from app.utils import _admin_only, _parse_date

forecast_api_bp = Blueprint("forecast_api", __name__, url_prefix="/api/admin/forecast")


def _model_comparison(candidate_metrics, chosen_algorithm):
    """Build a short model_comparison list from candidate_metrics."""
    if not candidate_metrics:
        return None
    comparison = []
    for algo, m in candidate_metrics.items():
        if not isinstance(m, dict):
            continue
        comparison.append({
            "algorithm": algo,
            "rmse": m.get("rmse"),
            "mae": m.get("mae"),
            "mape": m.get("mape"),
            "chosen": algo == chosen_algorithm,
        })
    comparison.sort(key=lambda x: x["rmse"] if x["rmse"] is not None else float("inf"))
    return comparison


def _serialize_run(run):
    return {
        "id": run.id,
        "municipality_id": run.municipality_id,
        "municipality_name": run.municipality.name if run.municipality else None,
        "period_start": run.period_start.isoformat(),
        "period_end": run.period_end.isoformat(),
        "algorithm": run.algorithm,
        "data_source": run.data_source,
        "readiness": run.readiness,
        "reliability": run.reliability,
        "trend_direction": run.trend_direction,
        "expected_change_pct": float(run.expected_change_pct) if run.expected_change_pct is not None else None,
        "projected_total": float(run.projected_total) if run.projected_total is not None else None,
        "mae": float(run.mae) if run.mae is not None else None,
        "rmse": float(run.rmse) if run.rmse is not None else None,
        "mape": float(run.mape) if run.mape is not None else None,
        "r2": float(run.r2) if run.r2 is not None else None,
        "candidate_metrics": run.candidate_metrics,
        "model_comparison": _model_comparison(run.candidate_metrics, run.algorithm),
        "backtest": run.backtest if hasattr(run, "backtest") else None,
        "incomplete_tail": bool(run.incomplete_tail),
        "note": run.note,
        "created_at": run.created_at.isoformat() + "Z" if run.created_at else None,
        "points": [
            {
                "period_label": p.period_label,
                "predicted_value": float(p.predicted_value) if p.predicted_value is not None else None,
                "lower_bound": float(p.lower_bound) if p.lower_bound is not None else None,
                "upper_bound": float(p.upper_bound) if p.upper_bound is not None else None,
                "is_forecast": p.is_forecast,
            }
            for p in sorted(run.points, key=lambda x: x.period_label)
        ],
    }


@forecast_api_bp.route("/run", methods=["POST"])
@login_required
def run():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    body = request.get_json(silent=True) or {}
    municipality_id = body.get("municipality_id")
    if municipality_id is not None and municipality_id != "":
        municipality_id = int(municipality_id)
    else:
        municipality_id = None

    forecast_horizon = int(body.get("forecast_horizon") or 12)
    if forecast_horizon < 1 or forecast_horizon > 36:
        return jsonify({"error": "forecast_horizon must be between 1 and 36."}), 400

    # Validate municipality_id exists when a specific scope is requested.
    if municipality_id is not None and not Municipality.query.get(municipality_id):
        return jsonify({"error": "municipality_id is invalid."}), 400

    # WHAT: The history window and forecast horizon are now auto-set: history is
    #      the last 3 years up to the last month with data; the forecast runs
    #      `forecast_horizon` months ahead from that last month. The client no
    #      longer sends period_start / period_end.
    #      municipality_id=None means "all municipalities" (province total =
    #      sum of municipality forecasts).
    if municipality_id is None:
        run_obj = run_forecast_all_municipalities(forecast_horizon)
    else:
        run_obj = run_forecast(municipality_id, forecast_horizon)
    return jsonify({"run": _serialize_run(run_obj)}), 201


@forecast_api_bp.route("/runs", methods=["GET"])
@login_required
def list_runs():
    """List forecast runs, newest first.

    Query: municipality_id (optional), scope="all" (the province-wide run,
           municipality_id IS NULL), latest="1" (only the newest run, which is
           all the Forecasting page needs and is far cheaper to serialize).
    """
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    municipality_id = request.args.get("municipality_id", type=int)
    scope = request.args.get("scope")
    latest = request.args.get("latest") in ("1", "true", "yes")
    source = request.args.get("source", "municipality_production")
    if source == "municipality_estimates":
        source = "municipality_production"
    if source not in ("municipality_production", "approved_records"):
        return jsonify({
            "error": "source must be municipality_production or approved_records."
        }), 400
    q = ForecastRun.query.filter_by(data_source=source)
    if scope == "all":
        # Province-wide run: municipality_id IS NULL.
        q = q.filter(ForecastRun.municipality_id.is_(None))
    elif municipality_id is not None:
        q = q.filter_by(municipality_id=municipality_id)
    runs = q.order_by(ForecastRun.created_at.desc()).limit(1 if latest else 50).all()

    return jsonify({"runs": [_serialize_run(r) for r in runs]})


@forecast_api_bp.route("/runs/<run_id>", methods=["GET"])
@login_required
def get_run(run_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    run = ForecastRun.query.get_or_404(run_id)
    return jsonify({"run": _serialize_run(run)})


@forecast_api_bp.route("/municipality-outlook", methods=["GET"])
@login_required
def outlook():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    data = get_municipality_outlook()
    return jsonify({"municipalities": data})


@forecast_api_bp.route("/evaluate-target", methods=["POST"])
@login_required
def evaluate_target_route():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    body = request.get_json(silent=True) or {}
    municipality_id = body.get("municipality_id")
    if municipality_id is not None and municipality_id != "":
        municipality_id = int(municipality_id)
    else:
        municipality_id = None

    annual_target = body.get("annual_target")
    if annual_target is None or str(annual_target).strip() == "":
        return jsonify({"error": "annual_target is required."}), 400

    forecast_horizon = int(body.get("forecast_horizon") or 12)

    split_method = body.get("split_method") or "equal"
    if split_method not in ("equal", "seasonal"):
        return jsonify({"error": "split_method must be 'equal' or 'seasonal'."}), 400

    target_basis = body.get("target_basis") or "annual"
    if target_basis not in ("annual", "period"):
        return jsonify({"error": "target_basis must be 'annual' or 'period'."}), 400

    try:
        result = evaluate_target(
            municipality_id,
            float(annual_target),
            forecast_horizon,
            split_method=split_method,
            target_basis=target_basis,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"evaluation": result})
