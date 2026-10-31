# WHAT: Business logic for adding/editing municipalities and their encoder
#       accounts (validation, slug/email generation, transactional writes).
# WHY: Keep the admin blueprint thin and make every rule testable in one place.
import json
import os
import re
import secrets
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.barangay import Barangay
from app.models.environment_report import EnvironmentReport
from app.models.forecast import ForecastPoint, ForecastRun
from app.models.municipality import Municipality
from app.models.municipality_production import (
    MunicipalityMonthlyProduction,
    MunicipalitySaltBedData,
)
from app.models.producer import Producer
from app.models.producer_report import ProducerReport, ProducerReportEntry
from app.models.production_record import ProductionRecord
from app.models.report import Report
from app.models.user import User
from app.services.audit import log_action

ENCODER_EMAIL_DOMAIN = "pangasin.gov.ph"
MAX_BARANGAYS = 100
MAX_NAME_LENGTH = 100


class MunicipalityValidationError(Exception):
    """User input failed validation; ``errors`` is a list of messages."""

    status_code = 400

    def __init__(self, errors):
        self.errors = list(errors)
        super().__init__("; ".join(self.errors))


class MunicipalityConflictError(Exception):
    """The requested change conflicts with existing data (HTTP 409)."""

    status_code = 409


def slugify(name):
    """Return the URL/e-mail-safe slug used by the encoder account and GeoJSON ref.

    Rules (approved): drop a leading "City of " and a trailing " City", lowercase,
    then remove everything that is not a letter or digit.
    "Alaminos City" -> "alaminos", "City of Urdaneta" -> "urdaneta",
    "San Fabian" -> "sanfabian".
    """
    value = (name or "").strip().lower()
    if value.startswith("city of "):
        value = value[len("city of "):]
    if value.endswith(" city"):
        value = value[: -len(" city")]
    return re.sub(r"[^a-z0-9]+", "", value)


def encoder_email(slug):
    return f"{slug}.encoder@{ENCODER_EMAIL_DOMAIN}"


def _clean_name(value, errors):
    if value is None:
        errors.append("name is required.")
        return None
    if not isinstance(value, str):
        errors.append("name must be a string.")
        return None
    name = " ".join(value.split())
    if not name:
        errors.append("name cannot be empty.")
        return None
    if len(name) > MAX_NAME_LENGTH:
        errors.append(f"name must be at most {MAX_NAME_LENGTH} characters.")
        return None
    return name


def _parse_coordinate(value, label, minimum, maximum, errors):
    if value is None or value == "":
        errors.append(f"{label} is required.")
        return None
    if isinstance(value, bool):
        errors.append(f"{label} must be a number.")
        return None
    try:
        number = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        errors.append(f"{label} must be a number.")
        return None
    if not number.is_finite():
        errors.append(f"{label} must be a finite number.")
        return None
    if number < minimum or number > maximum:
        errors.append(f"{label} must be between {minimum} and {maximum}.")
        return None
    if -number.as_tuple().exponent > 6:
        errors.append(f"{label} must have at most 6 decimal places.")
        return None
    return number


def _clean_barangay_name(value):
    if not isinstance(value, str):
        raise MunicipalityValidationError(["name must be a string."])
    name = " ".join(value.split())
    if not name:
        raise MunicipalityValidationError(["name cannot be empty."])
    if len(name) > MAX_NAME_LENGTH:
        raise MunicipalityValidationError(
            [f"name must be at most {MAX_NAME_LENGTH} characters."]
        )
    return name


def _clean_barangay_names(value, errors, *, required):
    if value is None:
        if required:
            errors.append("At least one barangay is required.")
        return []
    if not isinstance(value, list):
        errors.append("barangays must be a list of names.")
        return []

    cleaned = []
    seen = set()
    for raw in value:
        if not isinstance(raw, str):
            errors.append("Each barangay name must be a string.")
            continue
        name = " ".join(raw.split())
        if not name:
            errors.append("Barangay names cannot be empty.")
            continue
        if len(name) > MAX_NAME_LENGTH:
            errors.append(
                f"Barangay name must be at most {MAX_NAME_LENGTH} characters: {name!r}."
            )
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(name)

    if required and not cleaned:
        errors.append("At least one barangay is required.")
    if len(cleaned) > MAX_BARANGAYS:
        errors.append(f"A municipality can have at most {MAX_BARANGAYS} barangays.")
    return cleaned


def _validate_status(value, errors, default="active"):
    if value is None:
        return default
    if value not in ("active", "inactive"):
        errors.append("status must be active or inactive.")
        return default
    return value


def _validate_payload(data, *, creating):
    if not isinstance(data, dict):
        raise MunicipalityValidationError(["Request body must be a JSON object."])

    errors = []
    name = _clean_name(data.get("name"), errors) if (creating or "name" in data) else None
    latitude = (
        _parse_coordinate(data.get("latitude"), "latitude", -90, 90, errors)
        if (creating or "latitude" in data)
        else None
    )
    longitude = (
        _parse_coordinate(data.get("longitude"), "longitude", -180, 180, errors)
        if (creating or "longitude" in data)
        else None
    )
    status = (
        _validate_status(data.get("status"), errors, default="active")
        if creating
        else (
            _validate_status(data.get("status"), errors, default=None)
            if "status" in data
            else None
        )
    )
    barangays = (
        _clean_barangay_names(data.get("barangays"), errors, required=False)
        if (creating or "barangays" in data)
        else None
    )

    if errors:
        raise MunicipalityValidationError(errors)

    return {
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "status": status,
        "barangays": barangays if barangays is not None else [],
    }


def _assert_name_available(name, exclude_id=None):
    query = Municipality.query.filter(func.lower(Municipality.name) == name.lower())
    if exclude_id is not None:
        query = query.filter(Municipality.id != exclude_id)
    if query.first():
        raise MunicipalityConflictError(
            f"A municipality named {name!r} already exists (names are case-insensitive)."
        )


def _assert_email_available(email):
    if User.query.filter(func.lower(User.email) == email.lower()).first():
        raise MunicipalityConflictError(
            f"Encoder email {email} is already in use. Rename or release that account first."
        )


def _assert_geojson_ref_available(geojson_ref, exclude_id=None):
    query = Municipality.query.filter(Municipality.geojson_ref == geojson_ref)
    if exclude_id is not None:
        query = query.filter(Municipality.id != exclude_id)
    if query.first():
        raise MunicipalityConflictError(
            f"GeoJSON reference {geojson_ref!r} is already used by another municipality. "
            "Choose a different name."
        )


def _active_encoder(municipality_id):
    return (
        User.query.filter_by(
            role="encoder", municipality_id=municipality_id, status="active"
        )
        .order_by(User.id)
        .first()
    )


def serialize_barangay(barangay):
    return {"id": barangay.id, "name": barangay.name}


def serialize_encoder(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "status": user.status,
        "must_change_password": user.must_change_password,
    }


def _has_boundary_file(municipality):
    # WHAT: Check kung may actual na na-upload na GeoJSON file.
    # WHY: Reserved ang geojson_ref kahit walang file, kaya hindi ito pwedeng
    #      gamiting proof na may boundary; filesystem ang source of truth.
    ref = municipality.geojson_ref
    if not ref or not ref.startswith("geojson/"):
        return False
    from app.services import geojson_service

    try:
        return os.path.isfile(geojson_service.geojson_path(ref))
    except (OSError, ValueError, RuntimeError):
        return False


def serialize_municipality(municipality, encoder_count=None, record_count=None, encoders=None):
    if encoders is None:
        encoders = (
            User.query.filter_by(role="encoder", municipality_id=municipality.id)
            .order_by(User.name)
            .all()
        )
    if encoder_count is None:
        encoder_count = len(encoders)
    if record_count is None:
        record_count = ProductionRecord.query.filter_by(
            municipality_id=municipality.id
        ).count()

    return {
        "id": municipality.id,
        "name": municipality.name,
        "status": municipality.status,
        "latitude": float(municipality.latitude) if municipality.latitude is not None else None,
        "longitude": float(municipality.longitude) if municipality.longitude is not None else None,
        "geojson_ref": municipality.geojson_ref,
        "has_boundary": _has_boundary_file(municipality),
        "barangays": [
            serialize_barangay(barangay)
            for barangay in sorted(municipality.barangays, key=lambda item: item.name.lower())
        ],
        "encoders": [serialize_encoder(user) for user in encoders],
        "encoder_count": encoder_count,
        "record_count": record_count,
        "created_at": municipality.created_at.isoformat() if municipality.created_at else None,
        "updated_at": municipality.updated_at.isoformat() if municipality.updated_at else None,
    }


def create_municipality(data):
    """Validate and create a municipality plus its encoder account.

    Returns ``(municipality, encoder_result)`` where ``encoder_result`` is either::

        {"created": True, "encoder": {...}, "temporary_password": "..."}
        {"created": False, "existing_encoder": {...}}

    The temporary password is returned exactly once and is never logged or stored
    anywhere in plaintext.
    """
    payload = _validate_payload(data or {}, creating=True)
    _assert_name_available(payload["name"])

    slug = slugify(payload["name"])
    if not slug:
        raise MunicipalityValidationError(
            ["name must contain at least one letter or digit."]
        )
    geojson_ref = f"geojson/{slug}.json"
    _assert_geojson_ref_available(geojson_ref)

    municipality = Municipality(
        name=payload["name"],
        latitude=payload["latitude"],
        longitude=payload["longitude"],
        geojson_ref=geojson_ref,
        status=payload["status"],
    )
    encoder = None
    temporary_password = None

    try:
        db.session.add(municipality)
        db.session.flush()

        for name in payload["barangays"]:
            db.session.add(Barangay(municipality_id=municipality.id, name=name))

        # Defensive: if an active encoder is already linked to this municipality,
        # reuse it instead of creating a second account.
        existing_encoder = _active_encoder(municipality.id)
        if existing_encoder is not None:
            encoder_result = {
                "created": False,
                "existing_encoder": serialize_encoder(existing_encoder),
            }
        else:
            email = encoder_email(slug)
            _assert_email_available(email)
            temporary_password = secrets.token_urlsafe(9)
            encoder = User(
                name=f"Encoder - {municipality.name}",
                email=email,
                role="encoder",
                municipality_id=municipality.id,
                status="active" if municipality.status == "active" else "inactive",
                must_change_password=True,
            )
            encoder.set_password(temporary_password)
            db.session.add(encoder)
            encoder_result = None

        if encoder_result is None:
            encoder_result = {
                "created": True,
                "encoder": serialize_encoder(encoder),
                "temporary_password": temporary_password,
            }

        log_action(
            "municipality.create",
            "municipality",
            municipality.id,
            summary=f"Added municipality {municipality.name}.",
            details={
                "name": municipality.name,
                "status": municipality.status,
                "geojson_ref": municipality.geojson_ref,
                "barangays": payload["barangays"],
                "encoder_created": encoder_result["created"],
                "encoder_email": (
                    encoder_result.get("encoder", {}).get("email")
                    or encoder_result.get("existing_encoder", {}).get("email")
                ),
            },
        )
        db.session.commit()
    except MunicipalityConflictError:
        db.session.rollback()
        raise
    except IntegrityError:
        db.session.rollback()
        raise MunicipalityConflictError(
            "A municipality or encoder account with these details already exists."
        )

    return municipality, encoder_result


def _municipality_snapshot(municipality, barangays=None):
    # WHAT: Copy the auditable municipality fields for the audit entry.
    # WHY: The ORM object mutates in place, so the before-value must be copied.
    return {
        "name": municipality.name,
        "status": municipality.status,
        "latitude": float(municipality.latitude) if municipality.latitude is not None else None,
        "longitude": float(municipality.longitude) if municipality.longitude is not None else None,
        "barangays": sorted(
            barangays if barangays is not None
            else (barangay.name for barangay in municipality.barangays)
        ),
    }


def _new_barangay_names(municipality, payload):
    # WHAT: Return only the barangay names that are not attached yet.
    # WHY: Barangays are add-only on update, and the cap applies to the total.
    if not payload["barangays"]:
        return []
    existing_names = {barangay.name.lower() for barangay in municipality.barangays}
    new_barangays = [
        name for name in payload["barangays"] if name.lower() not in existing_names
    ]
    if len(municipality.barangays) + len(new_barangays) > MAX_BARANGAYS:
        raise MunicipalityValidationError(
            [f"A municipality can have at most {MAX_BARANGAYS} barangays."]
        )
    return new_barangays


def _apply_name_change(municipality, payload):
    # WHAT: Rename the municipality and move its slug-based geojson reference.
    # WHY: The boundary file follows the slug, so both must change together.
    if payload["name"] is None or payload["name"] == municipality.name:
        return
    _assert_name_available(payload["name"], exclude_id=municipality.id)
    slug = slugify(payload["name"])
    if not slug:
        raise MunicipalityValidationError(
            ["name must contain at least one letter or digit."]
        )
    geojson_ref = f"geojson/{slug}.json"
    _assert_geojson_ref_available(geojson_ref, exclude_id=municipality.id)
    municipality.name = payload["name"]
    municipality.geojson_ref = geojson_ref


def _apply_status_change(municipality, payload):
    # WHAT: Apply the status and deactivate encoders when it becomes inactive.
    # WHY: An inactive municipality must not keep active encoder accounts.
    if payload["status"] is None:
        return 0
    municipality.status = payload["status"]
    if municipality.status != "inactive":
        return 0
    encoders = User.query.filter_by(
        role="encoder", municipality_id=municipality.id, status="active"
    ).all()
    for encoder in encoders:
        encoder.status = "inactive"
    return len(encoders)


def _move_boundary_file(old_geojson_ref, new_geojson_ref):
    # WHAT: Keep an uploaded boundary attached to the municipality after a rename.
    # WHY: geojson_ref follows the new slug, so the stored file must move too or
    #      the boundary would silently disappear and the old file would be orphaned.
    if not (
        old_geojson_ref
        and new_geojson_ref
        and old_geojson_ref != new_geojson_ref
        and old_geojson_ref.startswith("geojson/")
    ):
        return
    from app.services import geojson_service

    old_path = geojson_service.geojson_path(old_geojson_ref)
    new_path = geojson_service.geojson_path(new_geojson_ref)
    if os.path.isfile(old_path):
        try:
            os.replace(old_path, new_path)
        except OSError:
            pass


def update_municipality(municipality, data):
    """Apply an edit. Barangays are add-only and deactivation disables encoders.

    Returns ``(municipality, deactivated_encoder_count)``.
    """
    payload = _validate_payload(data or {}, creating=False)
    old_geojson_ref = municipality.geojson_ref
    before = _municipality_snapshot(municipality)

    new_barangays = _new_barangay_names(municipality, payload)
    _apply_name_change(municipality, payload)

    if payload["latitude"] is not None:
        municipality.latitude = payload["latitude"]
    if payload["longitude"] is not None:
        municipality.longitude = payload["longitude"]

    deactivated = _apply_status_change(municipality, payload)

    for name in new_barangays:
        db.session.add(Barangay(municipality_id=municipality.id, name=name))

    after = _municipality_snapshot(
        municipality, barangays=before["barangays"] + new_barangays
    )
    changed = {
        key: {"from": before[key], "to": after[key]}
        for key in before
        if before[key] != after[key]
    }
    if changed:
        log_action(
            "municipality.update",
            "municipality",
            municipality.id,
            summary=f"Updated municipality {municipality.name}.",
            details={
                "changes": changed,
                "deactivated_encoder_count": deactivated,
            },
        )

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise MunicipalityConflictError(
            "That change conflicts with an existing municipality or barangay."
        )

    _move_boundary_file(old_geojson_ref, municipality.geojson_ref)

    return municipality, deactivated


def _municipality_dependency_counts(municipality):
    municipality_id = municipality.id
    barangay_ids = [
        row[0]
        for row in db.session.query(Barangay.id)
        .filter(Barangay.municipality_id == municipality_id)
        .all()
    ]
    return {
        "production_records": ProductionRecord.query.filter_by(
            municipality_id=municipality_id
        ).count(),
        "environment_reports": EnvironmentReport.query.filter_by(
            municipality_id=municipality_id
        ).count(),
        "producer_reports": ProducerReport.query.filter_by(
            municipality_id=municipality_id
        ).count(),
        "producers": (
            Producer.query.filter(Producer.barangay_id.in_(barangay_ids)).count()
            if barangay_ids
            else 0
        ),
        "reports": Report.query.filter_by(municipality_id=municipality_id).count(),
        "forecast_runs": ForecastRun.query.filter_by(
            municipality_id=municipality_id
        ).count(),
        "monthly_production": MunicipalityMonthlyProduction.query.filter_by(
            municipality_id=municipality_id
        ).count(),
        "salt_bed_data": MunicipalitySaltBedData.query.filter_by(
            municipality_id=municipality_id
        ).count(),
        "barangays": len(barangay_ids),
        "encoders": User.query.filter_by(
            municipality_id=municipality_id, role="encoder"
        ).count(),
    }


def _encoder_reference_count(user_id):
    """Count rows outside the deleted scope that still point at an encoder."""
    return (
        ProductionRecord.query.filter(
            or_(
                ProductionRecord.submitted_by == user_id,
                ProductionRecord.reviewed_by == user_id,
            )
        ).count()
        + EnvironmentReport.query.filter(
            or_(
                EnvironmentReport.submitted_by == user_id,
                EnvironmentReport.reviewed_by == user_id,
            )
        ).count()
        + ProducerReport.query.filter(
            or_(
                ProducerReport.submitted_by == user_id,
                ProducerReport.reviewed_by == user_id,
            )
        ).count()
        + Report.query.filter(Report.requested_by == user_id).count()
    )


def _remove_or_detach_encoders(municipality_id):
    """Delete linked encoders unless other data still references them.

    ``users.id`` is referenced with ``RESTRICT`` from production records,
    environment reports, producer reports, and generated reports. An encoder
    can be reassigned while older rows still point at them, so a hard delete
    must detach those accounts instead of failing on a foreign key.
    """
    encoders = User.query.filter_by(
        municipality_id=municipality_id, role="encoder"
    ).all()
    deleted = 0
    detached = 0
    for encoder in encoders:
        if _encoder_reference_count(encoder.id):
            encoder.municipality_id = None
            encoder.status = "inactive"
            detached += 1
        else:
            db.session.delete(encoder)
            deleted += 1
    return deleted, detached


_PROTECTED_DEPENDENCY_KEYS = (
    "production_records",
    "environment_reports",
    "producer_reports",
    "producers",
    "reports",
    "forecast_runs",
    "monthly_production",
    "salt_bed_data",
)


def _dependency_conflict(name, counts):
    # WHAT: Raise the standard conflict listing every protected dependency.
    # WHY: A destructive hard delete needs an explicit force confirmation.
    return MunicipalityConflictError(
        f"{name} still has dependent data "
        f"({counts['production_records']} production record(s), "
        f"{counts['environment_reports']} environment report(s), "
        f"{counts['producer_reports']} producer report(s), "
        f"{counts['producers']} producer(s), "
        f"{counts['reports']} generated report(s), "
        f"{counts['forecast_runs']} forecast run(s)). "
        "Re-send with force=true to delete all of it."
    )


def _collect_delete_targets(municipality_id):
    # WHAT: Gather child ids and stored report files before deleting rows.
    # WHY: The files must be removed by name after the database rows are gone.
    barangay_ids = [
        row[0]
        for row in db.session.query(Barangay.id)
        .filter(Barangay.municipality_id == municipality_id)
        .all()
    ]
    forecast_run_ids = [
        row[0]
        for row in db.session.query(ForecastRun.id)
        .filter(ForecastRun.municipality_id == municipality_id)
        .all()
    ]
    report_conditions = [Report.municipality_id == municipality_id]
    if barangay_ids:
        report_conditions.append(Report.barangay_id.in_(barangay_ids))
    report_files = [
        row[0]
        for row in db.session.query(Report.file_url)
        .filter(or_(*report_conditions))
        .all()
        if row[0]
    ]
    return barangay_ids, forecast_run_ids, report_files


def _delete_municipality_rows(municipality_id, barangay_ids, forecast_run_ids):
    # WHAT: Delete every row that belongs to the municipality.
    # WHY: Order matters: child rows must go before their parent rows.
    if barangay_ids:
        ProducerReportEntry.query.filter(
            ProducerReportEntry.barangay_id.in_(barangay_ids)
        ).delete(synchronize_session=False)
        Producer.query.filter(Producer.barangay_id.in_(barangay_ids)).delete(
            synchronize_session=False
        )
        EnvironmentReport.query.filter(
            EnvironmentReport.barangay_id.in_(barangay_ids)
        ).delete(synchronize_session=False)
        ProductionRecord.query.filter(
            ProductionRecord.barangay_id.in_(barangay_ids)
        ).delete(synchronize_session=False)
        Report.query.filter(Report.barangay_id.in_(barangay_ids)).delete(
            synchronize_session=False
        )

    ProducerReport.query.filter_by(municipality_id=municipality_id).delete(
        synchronize_session=False
    )
    EnvironmentReport.query.filter_by(municipality_id=municipality_id).delete(
        synchronize_session=False
    )
    ProductionRecord.query.filter_by(municipality_id=municipality_id).delete(
        synchronize_session=False
    )
    Report.query.filter_by(municipality_id=municipality_id).delete(
        synchronize_session=False
    )
    if forecast_run_ids:
        ForecastPoint.query.filter(ForecastPoint.run_id.in_(forecast_run_ids)).delete(
            synchronize_session=False
        )
        ForecastRun.query.filter(ForecastRun.id.in_(forecast_run_ids)).delete(
            synchronize_session=False
        )
    MunicipalityMonthlyProduction.query.filter_by(
        municipality_id=municipality_id
    ).delete(synchronize_session=False)
    MunicipalitySaltBedData.query.filter_by(municipality_id=municipality_id).delete(
        synchronize_session=False
    )
    Barangay.query.filter_by(municipality_id=municipality_id).delete(
        synchronize_session=False
    )


def _remove_boundary_file(geojson_ref):
    # WHAT: Delete the stored boundary file for a hard-deleted municipality.
    # WHY: The database row is gone, so geojson/<slug>.json would be orphaned.
    if not geojson_ref or not geojson_ref.startswith("geojson/"):
        return None
    from app.services import geojson_service

    try:
        path = geojson_service.geojson_path(geojson_ref)
        if os.path.isfile(path):
            os.remove(path)
            return True
    except OSError:
        return False
    return None


def _remove_report_files(report_files):
    # WHAT: Delete the stored files behind deleted report rows.
    # WHY: The report rows are gone, so their files would be orphaned.
    if not report_files:
        return None
    reports_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "static",
        "reports",
    )
    removed_reports = 0
    for stored_name in report_files:
        path = os.path.join(reports_dir, os.path.basename(stored_name))
        try:
            if os.path.isfile(path):
                os.remove(path)
                removed_reports += 1
        except OSError:
            pass
    return removed_reports


def delete_municipality(municipality, *, force=False):
    """Hard-delete a municipality and every row that belongs to it.

    Production data makes this destructive, so a caller that has not explicitly
    set ``force`` receives a conflict listing the dependent row counts. The
    blueprint translates that into a second, explicit confirmation in the UI.
    """
    municipality_id = municipality.id
    name = municipality.name
    geojson_ref = municipality.geojson_ref
    counts = _municipality_dependency_counts(municipality)
    protected_total = sum(
        counts[key] for key in _PROTECTED_DEPENDENCY_KEYS
    )

    if protected_total and not force:
        raise _dependency_conflict(name, counts)

    barangay_ids, forecast_run_ids, report_files = _collect_delete_targets(
        municipality_id
    )
    _delete_municipality_rows(municipality_id, barangay_ids, forecast_run_ids)

    deleted_encoders, detached_encoders = _remove_or_detach_encoders(municipality_id)
    counts["deleted_encoders"] = deleted_encoders
    counts["detached_encoders"] = detached_encoders

    log_action(
        "municipality.delete",
        "municipality",
        municipality_id,
        summary=f"Deleted municipality {name}.",
        details={"name": name, "force": bool(force), "deleted": counts},
    )
    Municipality.query.filter_by(id=municipality_id).delete(synchronize_session=False)
    db.session.commit()

    boundary_removed = _remove_boundary_file(geojson_ref)
    if boundary_removed is not None:
        counts["boundary_file_removed"] = boundary_removed

    removed_reports = _remove_report_files(report_files)
    if removed_reports is not None:
        counts["report_files_removed"] = removed_reports
    return counts


def rename_barangay(barangay, name):
    """Rename a barangay, keeping names unique within its municipality."""
    cleaned = _clean_barangay_name(name)
    conflict = (
        Barangay.query.filter(
            Barangay.municipality_id == barangay.municipality_id,
            func.lower(Barangay.name) == cleaned.lower(),
            Barangay.id != barangay.id,
        )
        .first()
    )
    if conflict:
        raise MunicipalityConflictError(
            f"A barangay named {cleaned!r} already exists in this municipality."
        )

    old_name = barangay.name
    if old_name == cleaned:
        return barangay

    barangay.name = cleaned
    log_action(
        "barangay.rename",
        "barangay",
        barangay.id,
        summary=f"Renamed barangay {old_name} to {cleaned}.",
        details={
            "municipality_id": barangay.municipality_id,
            "old_name": old_name,
            "new_name": cleaned,
        },
    )
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise MunicipalityConflictError(
            "That barangay name conflicts with an existing barangay."
        )
    return barangay


def delete_barangay(barangay):
    """Delete a barangay only when nothing references it."""
    counts = {
        "production_records": ProductionRecord.query.filter_by(
            barangay_id=barangay.id
        ).count(),
        "environment_reports": EnvironmentReport.query.filter_by(
            barangay_id=barangay.id
        ).count(),
        "producers": Producer.query.filter_by(barangay_id=barangay.id).count(),
        "producer_report_entries": ProducerReportEntry.query.filter_by(
            barangay_id=barangay.id
        ).count(),
        "reports": Report.query.filter_by(barangay_id=barangay.id).count(),
    }
    total = sum(counts.values())
    if total:
        raise MunicipalityConflictError(
            f"Cannot delete {barangay.name}: it is referenced by "
            f"{counts['production_records']} production record(s), "
            f"{counts['environment_reports']} environment report(s), "
            f"{counts['producers']} producer(s), "
            f"{counts['producer_report_entries']} producer report entrie(s), and "
            f"{counts['reports']} generated report(s). "
            "Reassign or remove those rows first."
        )

    name = barangay.name
    municipality_id = barangay.municipality_id
    log_action(
        "barangay.delete",
        "barangay",
        barangay.id,
        summary=f"Deleted barangay {name}.",
        details={"municipality_id": municipality_id, "name": name},
    )
    db.session.delete(barangay)
    db.session.commit()
    return True


def _seed_data_path():
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "pangasinan_municipalities.json",
    )


def load_seed_municipalities():
    with open(_seed_data_path(), encoding="utf-8") as handle:
        return json.load(handle)


def seed_municipalities(*, dry_run=False):
    """Create every Pangasinan municipality that is still missing.

    Existing names are skipped case-insensitively. Seeded municipalities have
    no barangays and no production records, but they do get the usual encoder
    account so data can be entered later.
    """
    entries = load_seed_municipalities()
    existing = {
        row[0].lower()
        for row in db.session.query(Municipality.name).all()
        if row[0]
    }
    missing = [entry for entry in entries if entry["name"].lower() not in existing]

    if dry_run:
        return {
            "dry_run": True,
            "created": [],
            "skipped": [],
            "would_create": [entry["name"] for entry in missing],
            "created_count": 0,
            "would_create_count": len(missing),
        }

    created = []
    skipped = []
    for entry in missing:
        payload = {
            "name": entry["name"],
            "latitude": entry["latitude"],
            "longitude": entry["longitude"],
            "status": "active",
            "barangays": [],
        }
        try:
            municipality, encoder_result = create_municipality(payload)
        except (MunicipalityValidationError, MunicipalityConflictError) as exc:
            skipped.append({"name": entry["name"], "reason": str(exc)})
            continue
        created.append(
            {
                "id": municipality.id,
                "name": municipality.name,
                "encoder": encoder_result,
            }
        )

    return {
        "dry_run": False,
        "created": created,
        "skipped": skipped,
        "created_count": len(created),
        "skipped_count": len(skipped),
    }


def list_municipalities_with_summaries():
    """Every municipality (active or not) with encoder/record counts."""
    municipalities = Municipality.query.order_by(Municipality.name).all()
    encoder_counts = dict(
        db.session.query(User.municipality_id, func.count(User.id))
        .filter(User.role == "encoder")
        .group_by(User.municipality_id)
        .all()
    )
    record_counts = dict(
        db.session.query(
            ProductionRecord.municipality_id, func.count(ProductionRecord.id)
        )
        .group_by(ProductionRecord.municipality_id)
        .all()
    )
    encoders_by_municipality = {}
    for user in (
        User.query.filter(User.role == "encoder")
        .order_by(User.name)
        .all()
    ):
        encoders_by_municipality.setdefault(user.municipality_id, []).append(user)

    return [
        serialize_municipality(
            municipality,
            encoder_count=encoder_counts.get(municipality.id, 0),
            record_count=record_counts.get(municipality.id, 0),
            encoders=encoders_by_municipality.get(municipality.id, []),
        )
        for municipality in municipalities
    ]
