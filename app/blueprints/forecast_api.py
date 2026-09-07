from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime, date
from app.extensions import db
from app.models.forecast import ForecastRun, ForecastPoint
from app.models.municipality import Municipality
from app.services.forecast_service import run_forecast, get_municipality_outlook, evaluate_target

forecast_api_bp = Blueprint("forecast_api", __name__, url_prefix="/api/admin/forecast")


def _admin_only():
    return current_user.role != "admin"


def _parse_date(date_str):
    if not date_str:
        return None
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def _serialize_run(run):
    return {
        "id": run.id,
        "municipality_id": run.municipality_id,
        "municipality_name": run.municipality.name if run.municipality else None,
        "period_start": run.period_start.isoformat(),
        "period_end": run.period_end.isoformat(),
        "algorithm": run.algorithm,
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

    period_start = _parse_date(body.get("period_start"))
    period_end = _parse_date(body.get("period_end"))
    forecast_horizon = int(body.get("forecast_horizon") or 12)

    if period_end and period_start and period_end <= period_start:
        return jsonify({"error": "period_end must be after period_start."}), 400

    horizon_months = forecast_horizon
    if period_end:
        ref = period_end
    else:
        ref = datetime.utcnow().date()
    y = ref.year + (ref.month + horizon_months - 1) // 12
    m = (ref.month + horizon_months - 1) % 12 + 1
    forecast_end = date(y, m, 1)

    run_obj = run_forecast(municipality_id, period_start or date(2020, 1, 1), period_end or ref, forecast_horizon)
    return jsonify({"run": _serialize_run(run_obj)}), 201


@forecast_api_bp.route("/runs", methods=["GET"])
@login_required
def list_runs():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    municipality_id = request.args.get("municipality_id", type=int)
    q = ForecastRun.query
    if municipality_id is not None:
        q = q.filter_by(municipality_id=municipality_id)
    runs = q.order_by(ForecastRun.created_at.desc()).limit(50).all()

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

    try:
        result = evaluate_target(municipality_id, float(annual_target), forecast_horizon)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"evaluation": result})
