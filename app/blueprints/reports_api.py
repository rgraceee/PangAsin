import os
from datetime import datetime

from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.report import Report, REPORT_TYPES, REPORT_FORMATS
from app.models.user import User
from app.services.report_service import generate_report_file, build_report_data

reports_api_bp = Blueprint("reports_api", __name__, url_prefix="/api/admin/reports")


def _admin_only():
    return current_user.role != "admin"


def _reports_dir():
    return os.path.join(current_app.root_path, "static", "reports")


def _parse_date(date_str):
    if not date_str:
        return None
    return datetime.strptime(str(date_str), "%Y-%m-%d").date()


@reports_api_bp.route("", methods=["POST"])
@login_required
def create_report():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    payload = request.get_json(silent=True) or {}
    report_type = (payload.get("report_type") or "").strip()
    fmt = (payload.get("format") or "excel").strip().lower()
    municipality_id = payload.get("municipality_id")
    start = _parse_date(payload.get("date_range_start"))
    end = _parse_date(payload.get("date_range_end"))

    if report_type not in REPORT_TYPES:
        return jsonify({"error": f"Invalid report_type. Must be one of: {', '.join(REPORT_TYPES)}"}), 400
    if fmt not in REPORT_FORMATS:
        return jsonify({"error": f"Invalid format. Must be one of: {', '.join(REPORT_FORMATS)}"}), 400
    if report_type == "municipality" and not municipality_id:
        return jsonify({"error": "municipality_id is required for the 'municipality' report type."}), 400
    if municipality_id:
        try:
            municipality_id = int(municipality_id)
        except (TypeError, ValueError):
            return jsonify({"error": "municipality_id must be an integer."}), 400

    report = Report(
        report_type=report_type,
        requested_by=current_user.id,
        municipality_id=municipality_id,
        date_range_start=start,
        date_range_end=end,
        format=fmt,
        status="pending",
    )
    db.session.add(report)
    db.session.flush()

    try:
        os.makedirs(_reports_dir(), exist_ok=True)
        filename, _filepath, data = generate_report_file(
            report_type,
            fmt,
            municipality_id=municipality_id,
            start=start,
            end=end,
            reports_dir=_reports_dir(),
        )
        report.file_url = filename
        report.status = "generated"
        report.generated_at = datetime.utcnow()
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        report.status = "failed"
        db.session.commit()
        return jsonify({"error": f"Report generation failed: {exc}"}), 500

    return jsonify({"report": report.serialize(), "data": data}), 201


@reports_api_bp.route("", methods=["GET"])
@login_required
def list_reports():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    q = Report.query.options(
        joinedload(Report.requester), joinedload(Report.municipality)
    )
    report_type = request.args.get("report_type")
    status = request.args.get("status")
    municipality_id = request.args.get("municipality_id")
    if report_type:
        q = q.filter(Report.report_type == report_type)
    if status:
        q = q.filter(Report.status == status)
    if municipality_id:
        q = q.filter(Report.municipality_id == int(municipality_id))
    reports = q.order_by(Report.created_at.desc()).all()
    return jsonify({"reports": [r.serialize() for r in reports]})


@reports_api_bp.route("/<int:report_id>", methods=["GET"])
@login_required
def get_report(report_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    report = Report.query.options(
        joinedload(Report.requester), joinedload(Report.municipality)
    ).get_or_404(report_id)
    data = None
    if report.status == "generated":
        try:
            data = build_report_data(
                report.report_type,
                report.municipality_id,
                report.date_range_start,
                report.date_range_end,
            )
        except Exception:  # noqa: BLE001
            data = None
    return jsonify({"report": report.serialize(), "data": data})


@reports_api_bp.route("/<int:report_id>/download", methods=["GET"])
@login_required
def download_report(report_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    report = Report.query.get_or_404(report_id)
    if not report.file_url:
        return jsonify({"error": "No file available for this report."}), 404
    filepath = os.path.join(_reports_dir(), report.file_url)
    if not os.path.exists(filepath):
        return jsonify({"error": "Report file not found on disk."}), 404
    return send_file(filepath, as_attachment=True, download_name=report.file_url)


@reports_api_bp.route("/<int:report_id>", methods=["DELETE"])
@login_required
def delete_report(report_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    report = Report.query.get_or_404(report_id)

    if report.file_url:
        filepath = os.path.join(_reports_dir(), report.file_url)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass

    db.session.delete(report)
    db.session.commit()

    return jsonify({"ok": True})
