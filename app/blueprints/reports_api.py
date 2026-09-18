import os
from datetime import datetime

from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.report import Report, REPORT_TYPES, REPORT_FORMATS
from app.models.user import User
from app.models.barangay import Barangay
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


REPORT_TYPE_NAMES = {
    "provincial": "Provincial-Summary",
    "municipality": "Municipality-Summary",
    "forecast": "Forecast-Report",
    "data_quality": "Data-Quality",
    "supply_demand": "Supply-Demand",
    "gis": "Geographic-Reference",
    "production": "Production",
    "producers": "Producers",
}


def _report_download_name(report, ext):
    """Human-friendly, report-specific filename for downloads.

    Example: ``Production_Province-wide_2025.pdf`` or
    ``Producers_Barangay-Germinal_2025-01-01_to_2025-12-31.docx``
    """
    label = REPORT_TYPE_NAMES.get(report.report_type, report.report_type)
    barangay = report.barangay.name if report.barangay else None
    municipality = report.municipality.name if report.municipality else None
    if barangay:
        scope = f"Barangay-{barangay}"
    elif municipality:
        scope = f"Municipality-{municipality}"
    else:
        scope = "Province-wide"

    start = report.date_range_start
    end = report.date_range_end
    if start and end and start.year == end.year and (
        start.isoformat() == f"{start.year}-01-01" and end.isoformat() == f"{end.year}-12-31"
    ):
        period = str(start.year)
    elif start and end:
        period = f"{start.isoformat()}_to_{end.isoformat()}"
    elif start:
        period = start.isoformat()
    elif end:
        period = end.isoformat()
    else:
        period = "All-records"

    name = f"{label}_{scope}_{period}.{ext}"
    return name.replace(" ", "_")


@reports_api_bp.route("", methods=["POST"])
@login_required
def create_report():
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    payload = request.get_json(silent=True) or {}
    report_type = (payload.get("report_type") or "").strip()
    fmt = (payload.get("format") or "pdf").strip().lower()
    municipality_id = payload.get("municipality_id")
    barangay_id = payload.get("barangay_id")
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
    if barangay_id:
        try:
            barangay_id = int(barangay_id)
        except (TypeError, ValueError):
            return jsonify({"error": "barangay_id must be an integer."}), 400
        barangay = db.session.get(Barangay, barangay_id)
        if not barangay:
            return jsonify({"error": "barangay_id is invalid."}), 400
        municipality_id = barangay.municipality_id

    report = Report(
        report_type=report_type,
        requested_by=current_user.id,
        municipality_id=municipality_id,
        barangay_id=barangay_id,
        date_range_start=start,
        date_range_end=end,
        format=fmt,
        status="pending",
    )
    try:
        db.session.add(report)
        db.session.flush()
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        return jsonify({"error": f"Could not save the report: {exc}"}), 500

    try:
        os.makedirs(_reports_dir(), exist_ok=True)
        filename, _filepath, data = generate_report_file(
            report_type,
            fmt,
            municipality_id=municipality_id,
            barangay_id=barangay_id,
            start=start,
            end=end,
            reports_dir=_reports_dir(),
        )
        # Deterministic name per report+format so the download endpoint can
        # always find/regenerate it and delete_report can clean it up.
        final_name = f"report_{report.id}.{fmt}"
        final_path = os.path.join(_reports_dir(), final_name)
        if os.path.abspath(_filepath) != os.path.abspath(final_path):
            os.replace(_filepath, final_path)
        report.file_url = final_name
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
        joinedload(Report.requester), joinedload(Report.municipality), joinedload(Report.barangay)
    )
    report_type = request.args.get("report_type")
    status = request.args.get("status")
    municipality_id = request.args.get("municipality_id")
    barangay_id = request.args.get("barangay_id")
    if report_type:
        q = q.filter(Report.report_type == report_type)
    if status:
        q = q.filter(Report.status == status)
    if municipality_id:
        q = q.filter(Report.municipality_id == int(municipality_id))
    if barangay_id:
        q = q.filter(Report.barangay_id == int(barangay_id))
    reports = q.order_by(Report.created_at.desc()).all()
    return jsonify({"reports": [r.serialize() for r in reports]})


@reports_api_bp.route("/<int:report_id>", methods=["GET"])
@login_required
def get_report(report_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    report = Report.query.options(
        joinedload(Report.requester), joinedload(Report.municipality), joinedload(Report.barangay)
    ).get_or_404(report_id)
    data = None
    if report.status == "generated":
        try:
            data = build_report_data(
                report.report_type,
                report.municipality_id,
                report.barangay_id,
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
    fmt = (request.args.get("format") or report.format or "pdf").strip().lower()
    if fmt not in REPORT_FORMATS:
        return jsonify({"error": f"Invalid format. Must be one of: {', '.join(REPORT_FORMATS)}"}), 400

    os.makedirs(_reports_dir(), exist_ok=True)
    filepath = os.path.join(_reports_dir(), f"report_{report.id}.{fmt}")
    if not os.path.exists(filepath):
        try:
            _filename, tmp_path, _data = generate_report_file(
                report.report_type,
                fmt,
                municipality_id=report.municipality_id,
                barangay_id=report.barangay_id,
                start=report.date_range_start,
                end=report.date_range_end,
                reports_dir=_reports_dir(),
            )
            if os.path.abspath(tmp_path) != os.path.abspath(filepath):
                os.replace(tmp_path, filepath)
        except Exception as exc:  # noqa: BLE001
            return jsonify({"error": f"Could not generate the {fmt.upper()} file: {exc}"}), 500
    return send_file(
        filepath,
        as_attachment=True,
        download_name=_report_download_name(report, fmt),
    )


@reports_api_bp.route("/<int:report_id>", methods=["DELETE"])
@login_required
def delete_report(report_id):
    if _admin_only():
        return jsonify({"error": "Admin access only."}), 403

    report = Report.query.get_or_404(report_id)

    for ext in ("pdf", "docx"):
        filepath = os.path.join(_reports_dir(), f"report_{report.id}.{ext}")
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass
    if report.file_url:
        legacy = os.path.join(_reports_dir(), os.path.basename(report.file_url))
        if legacy != os.path.join(_reports_dir(), f"report_{report.id}.pdf") and legacy != os.path.join(_reports_dir(), f"report_{report.id}.docx"):
            try:
                if os.path.exists(legacy):
                    os.remove(legacy)
            except OSError:
                pass

    db.session.delete(report)
    db.session.commit()

    return jsonify({"ok": True})
