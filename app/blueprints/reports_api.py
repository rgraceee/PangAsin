# WHAT: Report generation API endpoints (create, list, download, delete).
# WHY: Generation logic ay nasa report_service; dito lang ang HTTP/REST layer.
import math
import os
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, current_app, send_file
from flask_login import login_required, current_user
from sqlalchemy import String, cast
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.report import Report, REPORT_TYPES, REPORT_OUTPUT_FORMATS
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.environment_report import EnvironmentReport
from app.models.production_record import ProductionRecord
from app.models.producer import Producer
from app.services.report_service import generate_report_file, build_report_data
from app.utils import parse_iso_date

reports_api_bp = Blueprint("reports_api", __name__, url_prefix="/api/admin/reports")


def _reports_dir():
    # WHAT: Prefer an explicit writable directory when the host provides one.
    # WHY: Serverless hosts (Vercel) mount the project read-only; only /tmp is
    #      writable, so set REPORTS_DIR=/tmp/reports there. Local installs keep
    #      the existing app/static/reports location.
    configured = os.environ.get("REPORTS_DIR")
    if configured:
        return configured
    return os.path.join(current_app.root_path, "static", "reports")


REPORT_TYPE_NAMES = {
    "provincial": "Provincial-Summary",
    "municipality": "Municipality-Summary",
    "forecast": "Forecast-Report",
    "data_quality": "Data-Quality",
    "supply_demand": "Supply-Demand",
    "gis": "Geographic-Reference",
    "production": "Production",
    "producers": "Salt-Farmers",
    "environment": "Environment",
}
ENCODER_REPORT_TYPES = {"production", "producers", "environment"}

PRODUCER_FILTER_FIELDS = {
    "q",
    "sex",
    "age_group",
    "min_age",
    "max_age",
    "first_name",
    "last_name",
    "salt_farm_owner",
    "designation",
    "business_classification",
    "contact_number",
    "address",
    "production_method",
    "view",
}
PRODUCER_AGE_GROUPS = {"under30", "30to44", "45to59", "60plus"}
PRODUCTION_FILTER_FIELDS = {
    "production_method",
    "min_production_volume_mt",
    "max_production_volume_mt",
    "min_num_salt_beds",
    "max_num_salt_beds",
    "min_area_per_salt_bed",
    "max_area_per_salt_bed",
    "min_registered_producers",
    "max_registered_producers",
    "min_male_producers",
    "max_male_producers",
    "min_female_producers",
    "max_female_producers",
    "min_producers_18_30",
    "max_producers_18_30",
    "min_producers_31_40",
    "max_producers_31_40",
    "min_producers_41_50",
    "max_producers_41_50",
    "min_producers_51_60",
    "max_producers_51_60",
    "min_producers_61_plus",
    "max_producers_61_plus",
}
ENVIRONMENT_FILTER_FIELDS = {
    "production_method",
    "min_num_salt_beds",
    "max_num_salt_beds",
    "min_area_per_salt_bed",
    "max_area_per_salt_bed",
    "min_production_area_size",
    "max_production_area_size",
}
PRODUCTION_METHODS = {"solar", "cooked", "hybrid"}
PRODUCER_SUGGESTION_FIELDS = {
    "first_name": Producer.first_name,
    "last_name": Producer.last_name,
    "age": Producer.age,
    "min_age": Producer.age,
    "max_age": Producer.age,
    "salt_farm_owner": Producer.salt_farm_owner,
    "designation": Producer.designation,
    "business_classification": Producer.business_classification,
    "contact_number": Producer.contact_number,
    "address": Producer.address,
    "production_method": Producer.production_method,
}
PRODUCTION_SUGGESTION_FIELDS = {
    "production_method": ProductionRecord.production_method,
    **{
        name: getattr(ProductionRecord, column)
        for column, bounds in {
            "production_volume_mt": ("min_production_volume_mt", "max_production_volume_mt"),
            "num_salt_beds": ("min_num_salt_beds", "max_num_salt_beds"),
            "area_per_salt_bed": ("min_area_per_salt_bed", "max_area_per_salt_bed"),
            "registered_producers": ("min_registered_producers", "max_registered_producers"),
            "male_producers": ("min_male_producers", "max_male_producers"),
            "female_producers": ("min_female_producers", "max_female_producers"),
            "producers_18_30": ("min_producers_18_30", "max_producers_18_30"),
            "producers_31_40": ("min_producers_31_40", "max_producers_31_40"),
            "producers_41_50": ("min_producers_41_50", "max_producers_41_50"),
            "producers_51_60": ("min_producers_51_60", "max_producers_51_60"),
            "producers_61_plus": ("min_producers_61_plus", "max_producers_61_plus"),
        }.items()
        for name in bounds
    },
}
ENVIRONMENT_SUGGESTION_FIELDS = {
    "production_method": None,
    **{
        name: getattr(EnvironmentReport, column)
        for column, bounds in {
            "num_salt_beds": ("min_num_salt_beds", "max_num_salt_beds"),
            "area_per_salt_bed": ("min_area_per_salt_bed", "max_area_per_salt_bed"),
            "production_area_size": ("min_production_area_size", "max_production_area_size"),
        }.items()
        for name in bounds
    },
}


def _is_encoder():
    return current_user.role == "encoder"


def _encoder_report_error(report_type=None):
    if current_user.role not in {"admin", "superadmin", "encoder"}:
        return jsonify({"error": "Report access only."}), 403
    if _is_encoder():
        if not current_user.municipality_id:
            return jsonify({"error": "No municipality assigned."}), 403
        if report_type and report_type not in ENCODER_REPORT_TYPES:
            return jsonify({"error": "Encoders can only access production, salt farmer, and environment reports."}), 403
    return None


def _apply_encoder_scope(municipality_id, barangay_id):
    if not _is_encoder():
        return municipality_id, None
    assigned_municipality_id = current_user.municipality_id
    if municipality_id and municipality_id != assigned_municipality_id:
        return None, (jsonify({"error": "You can only access reports for your municipality."}), 403)
    if barangay_id:
        barangay = db.session.get(Barangay, barangay_id)
        if not barangay or barangay.municipality_id != assigned_municipality_id:
            return None, (jsonify({"error": "You can only access barangays in your municipality."}), 403)
    return assigned_municipality_id, None


def _encoder_can_access_report(report):
    return (
        not _is_encoder()
        or (
            report.municipality_id == current_user.municipality_id
            and report.report_type in ENCODER_REPORT_TYPES
        )
    )


def _normalize_content_filters(report_type, filters):
    if filters is None:
        return None
    if report_type == "producers":
        return _normalize_producer_filters(filters)
    if report_type not in {"production", "environment"}:
        raise ValueError("Content filters are only supported for production, salt farmer, and environment reports.")
    if not isinstance(filters, dict):
        raise ValueError("filters must be an object.")

    fields = PRODUCTION_FILTER_FIELDS if report_type == "production" else ENVIRONMENT_FILTER_FIELDS
    unknown = set(filters) - fields
    if unknown:
        raise ValueError(f"Unsupported {report_type} filters: {', '.join(sorted(unknown))}.")

    normalized = {}
    method = filters.get("production_method")
    if method not in (None, ""):
        if not isinstance(method, str) or method not in PRODUCTION_METHODS:
            raise ValueError("production_method must be solar, cooked, or hybrid.")
        normalized["production_method"] = method

    numeric_fields = fields - {"production_method"}
    for field in numeric_fields:
        value = filters.get(field)
        if value in (None, ""):
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"{field} must be a non-negative number.") from None
        if not math.isfinite(number) or number < 0:
            raise ValueError(f"{field} must be a non-negative number.")
        normalized[field] = number

    for minimum, maximum in (
        ("min_production_volume_mt", "max_production_volume_mt"),
        ("min_num_salt_beds", "max_num_salt_beds"),
        ("min_area_per_salt_bed", "max_area_per_salt_bed"),
        ("min_registered_producers", "max_registered_producers"),
        ("min_male_producers", "max_male_producers"),
        ("min_female_producers", "max_female_producers"),
        ("min_producers_18_30", "max_producers_18_30"),
        ("min_producers_31_40", "max_producers_31_40"),
        ("min_producers_41_50", "max_producers_41_50"),
        ("min_producers_51_60", "max_producers_51_60"),
        ("min_producers_61_plus", "max_producers_61_plus"),
        ("min_production_area_size", "max_production_area_size"),
    ):
        if minimum in normalized and maximum in normalized and normalized[minimum] > normalized[maximum]:
            raise ValueError(f"{minimum} cannot exceed {maximum}.")
    return normalized


def _normalize_producer_filters(filters):
    if not isinstance(filters, dict):
        raise ValueError("filters must be an object.")
    unknown = set(filters) - PRODUCER_FILTER_FIELDS
    if unknown:
        raise ValueError(f"Unsupported producer filters: {', '.join(sorted(unknown))}.")

    normalized = {}
    for field in PRODUCER_FILTER_FIELDS - {"min_age", "max_age", "view"}:
        value = filters.get(field)
        if value in (None, ""):
            continue
        if not isinstance(value, str) or len(value) > 255:
            raise ValueError(f"{field} must be a string of 255 characters or fewer.")
        normalized[field] = value.strip()

    sex = normalized.get("sex")
    if sex and sex not in {"Male", "Female", "Unknown"}:
        raise ValueError("sex must be Male, Female, or Unknown.")
    age_group = normalized.get("age_group")
    if age_group and age_group not in PRODUCER_AGE_GROUPS:
        raise ValueError(f"age_group must be one of: {', '.join(sorted(PRODUCER_AGE_GROUPS))}.")
    method = normalized.get("production_method")
    if method and method not in PRODUCTION_METHODS:
        raise ValueError("production_method must be solar, cooked, or hybrid.")

    for field in ("min_age", "max_age"):
        value = filters.get(field)
        if value in (None, ""):
            continue
        try:
            age = int(value)
        except (TypeError, ValueError):
            raise ValueError(f"{field} must be an integer.") from None
        if age < 0 or age > 120:
            raise ValueError(f"{field} must be between 0 and 120.")
        normalized[field] = age
    if (
        normalized.get("min_age") is not None
        and normalized.get("max_age") is not None
        and normalized["min_age"] > normalized["max_age"]
    ):
        raise ValueError("Minimum age cannot exceed maximum age.")

    view = filters.get("view")
    if view not in ("farmers", "by_barangay"):
        raise ValueError("view must be farmers or by_barangay.")
    normalized["view"] = view
    return normalized


def _suggestion_query(column, model, municipality_id, barangay_id, start, end):
    query = db.session.query(column).filter(column.isnot(None))
    if model is Producer:
        query = query.join(Barangay, Producer.barangay_id == Barangay.id)
        if municipality_id is not None:
            query = query.filter(Barangay.municipality_id == municipality_id)
        if barangay_id is not None:
            query = query.filter(Producer.barangay_id == barangay_id)
        return query
    if municipality_id is not None:
        query = query.filter(model.municipality_id == municipality_id)
    if barangay_id is not None:
        query = query.filter(model.barangay_id == barangay_id)
    if model is ProductionRecord:
        query = query.filter(
            ProductionRecord.status == "approved",
            ProductionRecord.deleted_at.is_(None),
        )
        if start:
            query = query.filter(ProductionRecord.record_date >= start)
        if end:
            query = query.filter(ProductionRecord.record_date <= end)
    elif model is EnvironmentReport:
        query = query.filter(EnvironmentReport.status == "approved")
        if start:
            query = query.filter(
                EnvironmentReport.submitted_at >= datetime.combine(start, datetime.min.time())
            )
        if end:
            query = query.filter(
                EnvironmentReport.submitted_at
                < datetime.combine(end + timedelta(days=1), datetime.min.time())
            )
    return query


@reports_api_bp.route("/encoder-options", methods=["GET"])
@login_required
def encoder_report_options():
    if current_user.role != "encoder":
        return jsonify({"error": "Encoder access only."}), 403
    if not current_user.municipality_id:
        return jsonify({"error": "No municipality assigned."}), 403

    municipality = db.session.get(Municipality, current_user.municipality_id)
    if not municipality:
        return jsonify({"error": "Assigned municipality was not found."}), 403

    barangays = (
        Barangay.query.filter_by(municipality_id=municipality.id)
        .order_by(Barangay.name)
        .all()
    )
    record_dates = (
        db.session.query(ProductionRecord.record_date)
        .filter(
            ProductionRecord.municipality_id == municipality.id,
            ProductionRecord.status == "approved",
            ProductionRecord.deleted_at.is_(None),
        )
        .distinct()
        .order_by(ProductionRecord.record_date)
        .all()
    )
    months = {record_date.strftime("%Y-%m") for (record_date,) in record_dates if record_date}
    months.add(datetime.utcnow().strftime("%Y-%m"))
    return jsonify({
        "municipality": {"id": municipality.id, "name": municipality.name},
        "barangays": [{"id": barangay.id, "name": barangay.name} for barangay in barangays],
        "months": sorted(months),
    })


@reports_api_bp.route("/suggestions", methods=["GET"])
@login_required
def report_filter_suggestions():
    report_type = request.args.get("report_type", "")
    access_error = _encoder_report_error(report_type)
    if access_error:
        return access_error
    field = request.args.get("field", "")
    search = request.args.get("q", "").strip()
    if report_type not in {"production", "producers", "environment"}:
        return jsonify({"error": "Unsupported report_type."}), 400
    if len(search) > 100:
        return jsonify({"error": "q must contain no more than 100 characters."}), 400

    municipality_id = request.args.get("municipality_id")
    barangay_id = request.args.get("barangay_id")
    if municipality_id:
        try:
            municipality_id = int(municipality_id)
        except (TypeError, ValueError):
            return jsonify({"error": "municipality_id must be an integer."}), 400
        if not db.session.get(Municipality, municipality_id):
            return jsonify({"error": "municipality_id is invalid."}), 400
    if barangay_id:
        try:
            barangay_id = int(barangay_id)
        except (TypeError, ValueError):
            return jsonify({"error": "barangay_id must be an integer."}), 400
        barangay = db.session.get(Barangay, barangay_id)
        if not barangay:
            return jsonify({"error": "barangay_id is invalid."}), 400
        if municipality_id and barangay.municipality_id != municipality_id:
            return jsonify({
                "error": "barangay_id does not belong to the given municipality_id."
            }), 400
        municipality_id = barangay.municipality_id
    municipality_id, scope_error = _apply_encoder_scope(municipality_id, barangay_id)
    if scope_error:
        return scope_error

    start = parse_iso_date(request.args.get("date_range_start"))
    end = parse_iso_date(request.args.get("date_range_end"))
    if request.args.get("date_range_start") and start is None:
        return jsonify({"error": "date_range_start must be a valid ISO date."}), 400
    if request.args.get("date_range_end") and end is None:
        return jsonify({"error": "date_range_end must be a valid ISO date."}), 400
    if start and end and start > end:
        return jsonify({"error": "date_range_start must be on or before date_range_end."}), 400

    if report_type == "producers" and field in {"first_name", "last_name"}:
        query = db.session.query(
            Producer.first_name,
            Producer.last_name,
            Producer.name,
        ).join(Barangay, Producer.barangay_id == Barangay.id)
        if municipality_id is not None:
            query = query.filter(Barangay.municipality_id == municipality_id)
        if barangay_id is not None:
            query = query.filter(Producer.barangay_id == barangay_id)
        if start:
            query = query.filter(
                Producer.created_at >= datetime.combine(start, datetime.min.time())
            )
        if end:
            query = query.filter(
                Producer.created_at < datetime.combine(end + timedelta(days=1), datetime.min.time())
            )

        suggestions = set()
        for first_name, last_name, name in query.all():
            name_parts = (name or "").split(maxsplit=1)
            value = (
                first_name or (name_parts[0] if name_parts else "")
                if field == "first_name"
                else last_name or (name_parts[1] if len(name_parts) > 1 else "")
            )
            if value and (not search or search.casefold() in value.casefold()):
                suggestions.add(value)
        return jsonify({"suggestions": sorted(suggestions, key=str.casefold)[:10]})

    escaped_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped_search}%"
    if report_type == "producers":
        model = Producer
        columns = (
            (Producer.first_name, Producer.last_name, Producer.address,
             Producer.salt_farm_owner, Producer.designation,
             Producer.business_classification, Producer.contact_number,
             Producer.production_method, Producer.name)
            if field == "q"
            else (PRODUCER_SUGGESTION_FIELDS.get(field),)
        )
        if any(column is None for column in columns):
            return jsonify({"error": "Unsupported suggestion field."}), 400
    elif report_type == "production":
        model = ProductionRecord
        column = PRODUCTION_SUGGESTION_FIELDS.get(field)
        if column is None:
            return jsonify({"error": "Unsupported suggestion field."}), 400
        columns = (column,)
    else:
        model = EnvironmentReport
        if field == "production_method":
            query = db.session.query(EnvironmentReport.production_methods).filter(
                EnvironmentReport.status == "approved"
            )
            if municipality_id is not None:
                query = query.filter(EnvironmentReport.municipality_id == municipality_id)
            if barangay_id is not None:
                query = query.filter(EnvironmentReport.barangay_id == barangay_id)
            if start:
                query = query.filter(
                    EnvironmentReport.submitted_at >= datetime.combine(start, datetime.min.time())
                )
            if end:
                query = query.filter(
                    EnvironmentReport.submitted_at
                    < datetime.combine(end + timedelta(days=1), datetime.min.time())
                )
            values = {
                method
                for (methods,) in query.distinct().all()
                for method in (methods or [])
                if isinstance(method, str)
                and (not search or search.lower() in method.lower())
            }
            return jsonify({"suggestions": sorted(values, key=str.casefold)[:10]})
        column = ENVIRONMENT_SUGGESTION_FIELDS.get(field)
        if column is None:
            return jsonify({"error": "Unsupported suggestion field."}), 400
        columns = (column,)

    suggestions = set()
    for column in columns:
        query = _suggestion_query(
            column, model, municipality_id, barangay_id, start, end
        )
        if search:
            query = query.filter(cast(column, String).ilike(pattern, escape="\\"))
        matches = query.distinct().order_by(column).limit(10).all()
        suggestions.update(str(value) for (value,) in matches)
    return jsonify({"suggestions": sorted(suggestions, key=str.casefold)[:10]})


def _report_download_name(report, ext):
    """Human-friendly, report-specific filename for downloads.

    Example: ``Production_Province-wide_2025.pdf`` or
    ``Salt-Farmers_Barangay-Germinal_2025-01-01_to_2025-12-31.xlsx``
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

    extension = {"excel": "xlsx"}.get(ext, ext)
    name = f"{label}_{scope}_{period}.{extension}"
    return name.replace(" ", "_")


@reports_api_bp.route("", methods=["POST"])
@login_required
def create_report():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be an object."}), 400
    report_type = (payload.get("report_type") or "").strip()
    access_error = _encoder_report_error(report_type)
    if access_error:
        return access_error
    fmt = (payload.get("format") or "pdf").strip().lower()
    municipality_id = payload.get("municipality_id")
    barangay_id = payload.get("barangay_id")
    start = parse_iso_date(payload.get("date_range_start"))
    end = parse_iso_date(payload.get("date_range_end"))
    title = payload.get("title")
    content_filters = payload.get("filters")

    if report_type not in REPORT_TYPES:
        return jsonify({"error": f"Invalid report_type. Must be one of: {', '.join(REPORT_TYPES)}"}), 400
    if not isinstance(title, str):
        return jsonify({"error": "title is required and must be a string."}), 400
    title = title.strip()
    if not title:
        return jsonify({"error": "title cannot be empty."}), 400
    if len(title) > 100:
        return jsonify({"error": "title must be 100 characters or fewer."}), 400
    if any(ord(character) < 32 or ord(character) == 127 for character in title):
        return jsonify({"error": "title cannot contain control characters."}), 400
    if content_filters is not None:
        try:
            content_filters = _normalize_content_filters(report_type, content_filters)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    if fmt not in REPORT_OUTPUT_FORMATS:
        return jsonify({"error": f"Invalid format. Must be one of: {', '.join(REPORT_OUTPUT_FORMATS)}"}), 400
    if report_type == "municipality" and not municipality_id:
        return jsonify({"error": "municipality_id is required for the 'municipality' report type."}), 400
    if municipality_id:
        try:
            municipality_id = int(municipality_id)
        except (TypeError, ValueError):
            return jsonify({"error": "municipality_id must be an integer."}), 400
        municipality = db.session.get(Municipality, municipality_id)
        if not municipality:
            return jsonify({"error": "municipality_id is invalid."}), 400
    if barangay_id:
        try:
            barangay_id = int(barangay_id)
        except (TypeError, ValueError):
            return jsonify({"error": "barangay_id must be an integer."}), 400
        barangay = db.session.get(Barangay, barangay_id)
        if not barangay:
            return jsonify({"error": "barangay_id is invalid."}), 400
        # WHAT: A barangay already identifies its municipality.
        # WHY: Reject mismatched pairs instead of silently overwriting the scope.
        if municipality_id and barangay.municipality_id != municipality_id:
            return jsonify({
                "error": "barangay_id does not belong to the given municipality_id."
            }), 400
        municipality_id = barangay.municipality_id
    municipality_id, scope_error = _apply_encoder_scope(municipality_id, barangay_id)
    if scope_error:
        return scope_error

    report = Report(
        report_type=report_type,
        requested_by=current_user.id,
        municipality_id=municipality_id,
        barangay_id=barangay_id,
        date_range_start=start,
        date_range_end=end,
        title=title,
        filters=content_filters,
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
            filters=content_filters,
            title=title,
        )
        report.title = title or data.get("report_title") or REPORT_TYPE_NAMES.get(report_type, report_type)
        data["report_title"] = report.title
        report.data_snapshot = data
        # Deterministic name per report+format so the download endpoint can
        # always find/regenerate it and delete_report can clean it up.
        extension = os.path.splitext(filename)[1].lstrip(".")
        final_name = f"report_{report.id}.{extension}"
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


@reports_api_bp.route("/preview", methods=["POST"])
@login_required
def preview_report():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Request body must be an object."}), 400
    report_type = (payload.get("report_type") or "").strip()
    access_error = _encoder_report_error(report_type)
    if access_error:
        return access_error
    if report_type not in REPORT_TYPES:
        return jsonify({"error": f"Invalid report_type. Must be one of: {', '.join(REPORT_TYPES)}"}), 400

    start_value = payload.get("date_range_start")
    end_value = payload.get("date_range_end")
    start = parse_iso_date(start_value)
    end = parse_iso_date(end_value)
    if start_value and start is None:
        return jsonify({"error": "date_range_start must be a valid ISO date."}), 400
    if end_value and end is None:
        return jsonify({"error": "date_range_end must be a valid ISO date."}), 400
    if start and end and start > end:
        return jsonify({"error": "date_range_start must be on or before date_range_end."}), 400

    municipality_id = payload.get("municipality_id")
    barangay_id = payload.get("barangay_id")
    if report_type == "municipality" and not municipality_id:
        return jsonify({"error": "municipality_id is required for the 'municipality' report type."}), 400
    if municipality_id:
        try:
            municipality_id = int(municipality_id)
        except (TypeError, ValueError):
            return jsonify({"error": "municipality_id must be an integer."}), 400
        if not db.session.get(Municipality, municipality_id):
            return jsonify({"error": "municipality_id is invalid."}), 400
    if barangay_id:
        try:
            barangay_id = int(barangay_id)
        except (TypeError, ValueError):
            return jsonify({"error": "barangay_id must be an integer."}), 400
        barangay = db.session.get(Barangay, barangay_id)
        if not barangay:
            return jsonify({"error": "barangay_id is invalid."}), 400
        if municipality_id and barangay.municipality_id != municipality_id:
            return jsonify({
                "error": "barangay_id does not belong to the given municipality_id."
            }), 400
        municipality_id = barangay.municipality_id
    municipality_id, scope_error = _apply_encoder_scope(municipality_id, barangay_id)
    if scope_error:
        return scope_error

    filters = payload.get("filters")
    if filters is not None:
        try:
            filters = _normalize_content_filters(report_type, filters)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    try:
        data = build_report_data(
            report_type,
            municipality_id,
            barangay_id,
            start,
            end,
            filters=filters,
        )
    except Exception as exc:  # noqa: BLE001
        current_app.logger.exception("Report preview failed")
        return jsonify({"error": f"Could not preview report: {exc}"}), 500
    return jsonify({"data": data})


@reports_api_bp.route("", methods=["GET"])
@login_required
def list_reports():
    access_error = _encoder_report_error()
    if access_error:
        return access_error

    q = Report.query.options(
        joinedload(Report.requester), joinedload(Report.municipality), joinedload(Report.barangay)
    )
    if _is_encoder():
        q = q.filter(
            Report.municipality_id == current_user.municipality_id,
            Report.report_type.in_(ENCODER_REPORT_TYPES),
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
    access_error = _encoder_report_error()
    if access_error:
        return access_error

    report = Report.query.options(
        joinedload(Report.requester), joinedload(Report.municipality), joinedload(Report.barangay)
    ).get_or_404(report_id)
    if not _encoder_can_access_report(report):
        return jsonify({"error": "Report not found."}), 404
    data = None
    if report.status == "generated":
        try:
            data = report.data_snapshot if report.data_snapshot is not None else build_report_data(
                report.report_type,
                report.municipality_id,
                report.barangay_id,
                report.date_range_start,
                report.date_range_end,
                filters=report.filters,
            )
            data["report_title"] = report.title or data.get("report_title", "Report")
        except Exception as exc:  # noqa: BLE001
            return jsonify({"error": f"Could not load report preview: {exc}"}), 500
    return jsonify({"report": report.serialize(), "data": data})


@reports_api_bp.route("/<int:report_id>/download", methods=["GET"])
@login_required
def download_report(report_id):
    access_error = _encoder_report_error()
    if access_error:
        return access_error

    report = Report.query.get_or_404(report_id)
    if not _encoder_can_access_report(report):
        return jsonify({"error": "Report not found."}), 404
    fmt = (request.args.get("format") or report.format or "pdf").strip().lower()
    if fmt not in REPORT_OUTPUT_FORMATS:
        return jsonify({"error": f"Invalid format. Must be one of: {', '.join(REPORT_OUTPUT_FORMATS)}"}), 400

    os.makedirs(_reports_dir(), exist_ok=True)
    extension = {"excel": "xlsx"}.get(fmt, fmt)
    filepath = os.path.join(_reports_dir(), f"report_{report.id}.{extension}")
    if report.data_snapshot is not None or not os.path.exists(filepath):
        try:
            _filename, tmp_path, _data = generate_report_file(
                report.report_type,
                fmt,
                municipality_id=report.municipality_id,
                barangay_id=report.barangay_id,
                start=report.date_range_start,
                end=report.date_range_end,
                reports_dir=_reports_dir(),
                filters=report.filters,
                data_snapshot=report.data_snapshot,
                title=report.title,
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
    if current_user.role not in {"admin", "superadmin"}:
        return jsonify({"error": "Admin access only."}), 403

    report = Report.query.get_or_404(report_id)

    for ext in ("pdf", "docx", "xlsx", "excel"):
        filepath = os.path.join(_reports_dir(), f"report_{report.id}.{ext}")
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass
    if report.file_url:
        legacy = os.path.join(_reports_dir(), os.path.basename(report.file_url))
        if legacy not in {
            os.path.join(_reports_dir(), f"report_{report.id}.{ext}")
            for ext in ("pdf", "docx", "xlsx", "excel")
        }:
            try:
                if os.path.exists(legacy):
                    os.remove(legacy)
            except OSError:
                pass

    db.session.delete(report)
    db.session.commit()

    return jsonify({"ok": True})
