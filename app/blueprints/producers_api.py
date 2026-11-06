from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import or_

from app.extensions import db
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.producer import Producer
from app.models.production_record import PRODUCTION_METHODS


producers_api_bp = Blueprint("producers_api", __name__, url_prefix="/api/producers")
ALLOWED_SEXES = {"Male", "Female", "Unknown"}
ALLOWED_PRODUCTION_METHODS = set(PRODUCTION_METHODS)
AGE_BANDS = ("18-30", "31-40", "41-50", "51-60", "61+")
AGE_GROUPS = ("under30", "30to44", "45to59", "60plus")


def _authorized():
    # WHAT: SuperAdmin inherits every Admin capability.
    return current_user.role in ("admin", "encoder", "superadmin")


def _serialize(producer):
    barangay = producer.barangay
    municipality = barangay.municipality if barangay else None
    name_parts = producer.name.split(maxsplit=1)
    return {
        "id": producer.id,
        "name": producer.name,
        "first_name": producer.first_name or (name_parts[0] if name_parts else None),
        "last_name": producer.last_name or (name_parts[1] if len(name_parts) > 1 else None),
        "age": producer.age,
        "age_bracket": producer.age_bracket,
        "sex": producer.sex,
        "address": producer.address,
        "salt_farm_owner": producer.salt_farm_owner,
        "designation": producer.designation,
        "business_classification": producer.business_classification,
        "contact_number": producer.contact_number,
        "production_method": producer.production_method,
        "barangay_id": producer.barangay_id,
        "barangay": barangay.name if barangay else None,
        "municipality_id": municipality.id if municipality else None,
        "municipality": municipality.name if municipality else None,
        "created_at": producer.created_at.isoformat() if producer.created_at else None,
        "updated_at": producer.updated_at.isoformat() if producer.updated_at else None,
    }


def _age_bands(producers):
    """Count the master list into the five age bands used by Admin.

    WHAT: The same banding as the Admin Salt Farmers card (<=30, <=40, <=50,
          <=60, 61+). Producers without a recorded age are left out.
    WHY: The Encoder Age card must read the same numbers as Admin, and the
         Encoder master-list page must keep receiving the same list shape.
    """
    bands = {band: 0 for band in AGE_BANDS}
    for producer in producers:
        age = producer.age
        if age is None:
            continue
        if age <= 30:
            bands["18-30"] += 1
        elif age <= 40:
            bands["31-40"] += 1
        elif age <= 50:
            bands["41-50"] += 1
        elif age <= 60:
            bands["51-60"] += 1
        else:
            bands["61+"] += 1
    return bands


def _matches_age_group(age, group):
    """Return True when ``age`` belongs to the master-list age group.

    WHAT: The same four groups the master-list filter offers (under 30,
          30-44, 45-59, 60 and above). Producers without an age never match.
    WHY: The filter used to run in the browser, which stops being correct once
         the table asks the server for one page at a time.
    """
    if age is None:
        return False
    if group == "under30":
        return age < 30
    if group == "30to44":
        return 30 <= age <= 44
    if group == "45to59":
        return 45 <= age <= 59
    if group == "60plus":
        return age >= 60
    return True


def _scoped_barangays():
    query = Barangay.query.join(Municipality)
    if current_user.role == "encoder":
        if not current_user.municipality_id:
            return query.filter(Barangay.id == -1)
        query = query.filter(Barangay.municipality_id == current_user.municipality_id)
    municipality_id = request.args.get("municipality_id", type=int)
    if municipality_id:
        query = query.filter(Barangay.municipality_id == municipality_id)
    return query.order_by(Municipality.name, Barangay.name)


@producers_api_bp.route("", methods=["GET"])
@login_required
def list_producers():
    if not _authorized():
        return jsonify({"error": "Admin or encoder access only."}), 403
    if current_user.role == "encoder" and not current_user.municipality_id:
        return jsonify({"error": "No municipality assigned."}), 400

    query = Producer.query.join(Barangay).join(Municipality)
    if current_user.role == "encoder":
        query = query.filter(Barangay.municipality_id == current_user.municipality_id)
    else:
        municipality_id = request.args.get("municipality_id", type=int)
        if municipality_id:
            query = query.filter(Barangay.municipality_id == municipality_id)

    barangay_id = request.args.get("barangay_id", type=int)
    if barangay_id:
        query = query.filter(Producer.barangay_id == barangay_id)

    sex = (request.args.get("sex") or "").strip()
    if sex and sex not in ALLOWED_SEXES:
        return jsonify({"error": "sex must be Male, Female, or Unknown."}), 400
    suggestion_query = query
    if sex == "Unknown":
        suggestion_query = suggestion_query.filter(or_(Producer.sex.is_(None), Producer.sex == "Unknown"))
    elif sex:
        suggestion_query = suggestion_query.filter(Producer.sex == sex)

    filter_options = {}
    for field in ("salt_farm_owner", "designation", "business_classification", "address"):
        column = getattr(Producer, field)
        filter_options[field] = [
            value
            for (value,) in (
                suggestion_query.with_entities(column)
                .filter(column.isnot(None), column != "")
                .distinct()
                .order_by(column)
                .all()
            )
        ]
    filter_options["production_method"] = [
        value
        for (value,) in (
            suggestion_query.with_entities(Producer.production_method)
            .filter(Producer.production_method.isnot(None), Producer.production_method != "")
            .distinct()
            .order_by(Producer.production_method)
            .all()
        )
    ]

    production_method = (request.args.get("production_method") or "").strip()
    if production_method and production_method not in ALLOWED_PRODUCTION_METHODS:
        return jsonify({"error": "production_method must be solar, cooked, or hybrid."}), 400
    if production_method:
        query = query.filter(Producer.production_method == production_method)

    text_filters = (
        ("first_name", Producer.first_name),
        ("last_name", Producer.last_name),
        ("salt_farm_owner", Producer.salt_farm_owner),
        ("designation", Producer.designation),
        ("business_classification", Producer.business_classification),
        ("contact_number", Producer.contact_number),
        ("address", Producer.address),
    )
    for parameter, column in text_filters:
        value = (request.args.get(parameter) or "").strip()
        if value:
            query = query.filter(column.ilike(f"%{value}%"))

    min_age = request.args.get("min_age", type=int)
    max_age = request.args.get("max_age", type=int)
    if min_age is not None:
        query = query.filter(Producer.age >= min_age)
    if max_age is not None:
        query = query.filter(Producer.age <= max_age)
    if min_age is not None and max_age is not None and min_age > max_age:
        return jsonify({"error": "Minimum age cannot exceed maximum age."}), 400

    search = (request.args.get("q") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(
            Producer.name.ilike(pattern),
            Producer.first_name.ilike(pattern),
            Producer.last_name.ilike(pattern),
            Producer.address.ilike(pattern),
            Producer.salt_farm_owner.ilike(pattern),
            Producer.designation.ilike(pattern),
            Producer.business_classification.ilike(pattern),
            Producer.contact_number.ilike(pattern),
            Producer.production_method.ilike(pattern),
            Producer.address.ilike(pattern),
        ))

    age_group = (request.args.get("age_group") or "").strip()
    if age_group and age_group not in AGE_GROUPS:
        return jsonify({"error": f"age_group must be one of: {', '.join(AGE_GROUPS)}."}), 400

    producers = query.order_by(Municipality.name, Barangay.name, Producer.name).all()
    by_barangay = {}
    for producer in producers:
        barangay_id = producer.barangay_id
        aggregate = by_barangay.setdefault(barangay_id, {
            "barangay": producer.barangay.name,
            "municipality": producer.barangay.municipality.name,
            "total": 0,
        })
        aggregate["total"] += 1
    # WHAT: Statistics describe the whole scope (municipality/barangay/search),
    #       not the Sex/Age filter or the current page.
    # WHY: the KPI cards must not change while the reader pages through the table.
    statistics = {
        "total": len(producers),
        "male": sum(producer.sex == "Male" for producer in producers),
        "female": sum(producer.sex == "Female" for producer in producers),
        "other": sum(producer.sex == "Other" for producer in producers),
        "unknown_sex": sum(producer.sex in (None, "Unknown") for producer in producers),
        "average_age": round(sum(p.age for p in producers if p.age is not None) / max(1, sum(p.age is not None for p in producers)), 1)
        if any(p.age is not None for p in producers) else None,
        "age_bands": _age_bands(producers),
        "by_barangay": sorted(by_barangay.values(), key=lambda row: (row["municipality"], row["barangay"])),
    }

    # WHAT: The Sex and Age filters are applied here, in the same scope list.
    # WHY: filtering the loaded list keeps one query and one counting rule.
    if sex and sex != "Unknown":
        producers = [producer for producer in producers if producer.sex == sex]
    elif sex == "Unknown":
        producers = [producer for producer in producers if producer.sex in (None, "Unknown")]
    if age_group:
        producers = [producer for producer in producers if _matches_age_group(producer.age, age_group)]
    filtered_by_barangay = {}
    for producer in producers:
        aggregate = filtered_by_barangay.setdefault(producer.barangay_id, {
            "barangay": producer.barangay.name,
            "municipality": producer.barangay.municipality.name,
            "total": 0,
        })
        aggregate["total"] += 1
    statistics["by_barangay"] = sorted(
        filtered_by_barangay.values(),
        key=lambda row: (row["municipality"], row["barangay"]),
    )

    # WHAT: Optional pagination — the master list asks for one page at a time.
    # WHY: the dashboard and the profile cards call this endpoint without `page`
    #      and still receive the full list, so nothing else changes.
    total = len(producers)
    page = request.args.get("page", type=int)
    per_page = min(100, max(1, request.args.get("per_page", 10, type=int) or 10))
    if page:
        page = max(1, page)
        start = (page - 1) * per_page
        visible = producers[start:start + per_page]
        pages = (total + per_page - 1) // per_page
    else:
        page = 1
        per_page = max(total, 1)
        visible = producers
        pages = 1 if total else 0

    municipalities = (
        Municipality.query.order_by(Municipality.name).all()
        if current_user.role in ("admin", "superadmin")
        else []
    )
    return jsonify({
        "producers": [_serialize(producer) for producer in visible],
        "statistics": statistics,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
        "municipalities": [{"id": item.id, "name": item.name} for item in municipalities],
        "filter_options": filter_options,
        "barangays": [
            {"id": barangay.id, "name": barangay.name, "municipality_id": barangay.municipality_id,
             "municipality": barangay.municipality.name}
            for barangay in _scoped_barangays().all()
        ],
    })


@producers_api_bp.route("", methods=["POST"])
@login_required
def create_producer():
    if not _authorized():
        return jsonify({"error": "Admin or encoder access only."}), 403
    data = request.get_json(silent=True) or {}
    profile_fields = {}
    errors = []
    for field, max_length, label in (
        ("first_name", 100, "First name"),
        ("last_name", 100, "Last name"),
        ("salt_farm_owner", 255, "Name of salt farm/owner"),
        ("designation", 100, "Designation"),
        ("business_classification", 100, "Business classification"),
        ("contact_number", 32, "Contact number"),
    ):
        value = data.get(field)
        if value in (None, ""):
            profile_fields[field] = None
        elif not isinstance(value, str) or len(value.strip()) > max_length:
            errors.append(f"{label} must be {max_length} characters or fewer.")
        else:
            profile_fields[field] = value.strip() or None
    production_method = data.get("production_method")
    if production_method in (None, ""):
        production_method = None
    elif not isinstance(production_method, str) or production_method not in ALLOWED_PRODUCTION_METHODS:
        errors.append("Production method must be Solar, Cooked, or Hybrid.")
        production_method = None
    profile_fields["production_method"] = production_method

    name = (data.get("name") or "").strip()
    if not name:
        name = " ".join(
            part for part in (profile_fields.get("first_name"), profile_fields.get("last_name")) if part
        )
    address = (data.get("address") or "").strip()
    sex = data.get("sex")
    if not name or len(name) > 150:
        errors.append("Name is required and must be 150 characters or fewer.")
    if len(address) > 255:
        errors.append("Address must be 255 characters or fewer.")
    if sex not in (None, "") and sex not in ALLOWED_SEXES:
        errors.append("Sex must be Male or Female.")
    raw_age = data.get("age")
    if raw_age in (None, ""):
        age = None
    else:
        try:
            if isinstance(raw_age, bool) or isinstance(raw_age, float) and not raw_age.is_integer():
                raise ValueError
            age = int(raw_age)
            if age < 0 or age > 120:
                errors.append("Age must be between 0 and 120.")
        except (TypeError, ValueError):
            age = None
            errors.append("Age must be a whole number.")
    try:
        barangay_id = int(data.get("barangay_id"))
    except (TypeError, ValueError):
        barangay_id = None
    barangay = db.session.get(Barangay, barangay_id) if barangay_id else None
    if not barangay:
        errors.append("A valid barangay is required.")
    elif current_user.role == "encoder" and barangay.municipality_id != current_user.municipality_id:
        errors.append("Barangay must belong to your municipality.")
    if errors:
        return jsonify({"errors": errors}), 400

    producer = Producer(
        barangay_id=barangay.id,
        name=name,
        **profile_fields,
        age=age,
        sex=None if sex in (None, "", "Unknown") else sex,
        address=address or None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(producer)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not add this salt farmer. Please try again."}), 500
    return jsonify(_serialize(producer)), 201


@producers_api_bp.route("/<int:producer_id>", methods=["PATCH"])
@login_required
def update_producer(producer_id):
    if not _authorized():
        return jsonify({"error": "Admin or encoder access only."}), 403
    producer = db.session.get(Producer, producer_id)
    if not producer:
        return jsonify({"error": "Salt farmer not found."}), 404
    if current_user.role == "encoder" and producer.barangay.municipality_id != current_user.municipality_id:
        return jsonify({"error": "Salt farmer is outside your municipality."}), 403

    data = request.get_json(silent=True) or {}
    errors = []
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name or len(name) > 150:
            errors.append("Name is required and must be 150 characters or fewer.")
        else:
            producer.name = name
    if "address" in data:
        address = (data.get("address") or "").strip()
        if len(address) > 255:
            errors.append("Address must be 255 characters or fewer.")
        else:
            producer.address = address or None
    if "sex" in data:
        if data["sex"] not in (None, "") and data["sex"] not in ALLOWED_SEXES:
            errors.append("Sex must be Male or Female.")
        else:
            producer.sex = None if data["sex"] in (None, "", "Unknown") else data["sex"]
    for field, max_length, label in (
        ("first_name", 100, "First name"),
        ("last_name", 100, "Last name"),
        ("salt_farm_owner", 255, "Name of salt farm/owner"),
        ("designation", 100, "Designation"),
        ("business_classification", 100, "Business classification"),
        ("contact_number", 32, "Contact number"),
    ):
        if field in data:
            value = data[field]
            if value in (None, ""):
                setattr(producer, field, None)
            elif not isinstance(value, str) or len(value.strip()) > max_length:
                errors.append(f"{label} must be {max_length} characters or fewer.")
            else:
                setattr(producer, field, value.strip() or None)
    if "production_method" in data:
        production_method = data["production_method"]
        if production_method in (None, ""):
            producer.production_method = None
        elif not isinstance(production_method, str) or production_method not in ALLOWED_PRODUCTION_METHODS:
            errors.append("Production method must be Solar, Cooked, or Hybrid.")
        else:
            producer.production_method = production_method
    if "name" not in data and ("first_name" in data or "last_name" in data):
        updated_name = " ".join(
            part for part in (producer.first_name, producer.last_name) if part
        )
        if not updated_name or len(updated_name) > 150:
            errors.append("First and last name must form a name of 150 characters or fewer.")
        else:
            producer.name = updated_name
    if "age" in data:
        if data["age"] in (None, ""):
            producer.age = None
        else:
            try:
                raw_age = data["age"]
                if isinstance(raw_age, bool) or isinstance(raw_age, float) and not raw_age.is_integer():
                    raise ValueError
                age = int(raw_age)
                if age < 0 or age > 120:
                    errors.append("Age must be between 0 and 120.")
                else:
                    producer.age = age
                    producer.age_bracket = None
            except (TypeError, ValueError):
                errors.append("Age must be a whole number.")
    if "barangay_id" in data:
        try:
            barangay_id = int(data["barangay_id"])
        except (TypeError, ValueError):
            barangay_id = None
        barangay = db.session.get(Barangay, barangay_id) if barangay_id else None
        if not barangay:
            errors.append("A valid barangay is required.")
        elif current_user.role == "encoder" and barangay.municipality_id != current_user.municipality_id:
            errors.append("Barangay must belong to your municipality.")
        else:
            producer.barangay = barangay
    if errors:
        return jsonify({"errors": errors}), 400

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not update this salt farmer. Please try again."}), 500
    return jsonify(_serialize(producer))


@producers_api_bp.route("/<int:producer_id>", methods=["DELETE"])
@login_required
def delete_producer(producer_id):
    if not _authorized():
        return jsonify({"error": "Admin or encoder access only."}), 403
    producer = db.session.get(Producer, producer_id)
    if not producer:
        return jsonify({"error": "Salt farmer not found."}), 404
    if current_user.role == "encoder" and producer.barangay.municipality_id != current_user.municipality_id:
        return jsonify({"error": "Salt farmer is outside your municipality."}), 403
    db.session.delete(producer)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not delete this salt farmer. Please try again."}), 500
    return jsonify({"deleted": producer_id})