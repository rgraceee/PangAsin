from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import or_

from app.extensions import db
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.producer import Producer


producers_api_bp = Blueprint("producers_api", __name__, url_prefix="/api/producers")
ALLOWED_SEXES = {"Male", "Female", "Other"}


def _authorized():
    return current_user.role in ("admin", "encoder")


def _serialize(producer):
    barangay = producer.barangay
    municipality = barangay.municipality if barangay else None
    return {
        "id": producer.id,
        "name": producer.name,
        "age": producer.age,
        "age_bracket": producer.age_bracket,
        "sex": producer.sex,
        "address": producer.address,
        "barangay_id": producer.barangay_id,
        "barangay": barangay.name if barangay else None,
        "municipality_id": municipality.id if municipality else None,
        "municipality": municipality.name if municipality else None,
        "created_at": producer.created_at.isoformat() if producer.created_at else None,
        "updated_at": producer.updated_at.isoformat() if producer.updated_at else None,
    }


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
    search = (request.args.get("q") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(Producer.name.ilike(pattern), Producer.address.ilike(pattern)))

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
    statistics = {
        "total": len(producers),
        "male": sum(producer.sex == "Male" for producer in producers),
        "female": sum(producer.sex == "Female" for producer in producers),
        "other": sum(producer.sex == "Other" for producer in producers),
        "average_age": round(sum(p.age for p in producers if p.age is not None) / max(1, sum(p.age is not None for p in producers)), 1)
        if any(p.age is not None for p in producers) else None,
        "by_barangay": sorted(by_barangay.values(), key=lambda row: (row["municipality"], row["barangay"])),
    }
    municipalities = Municipality.query.order_by(Municipality.name).all() if current_user.role == "admin" else []
    return jsonify({
        "producers": [_serialize(producer) for producer in producers],
        "statistics": statistics,
        "municipalities": [{"id": item.id, "name": item.name} for item in municipalities],
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
    name = (data.get("name") or "").strip()
    address = (data.get("address") or "").strip()
    sex = data.get("sex")
    errors = []
    if not name or len(name) > 150:
        errors.append("Name is required and must be 150 characters or fewer.")
    if not address or len(address) > 255:
        errors.append("Address is required and must be 255 characters or fewer.")
    if sex not in ALLOWED_SEXES:
        errors.append("Sex must be Male, Female, or Other.")
    raw_age = data.get("age")
    try:
        if isinstance(raw_age, bool) or isinstance(raw_age, float) and not raw_age.is_integer():
            raise ValueError
        age = int(raw_age)
        if age < 0 or age > 120:
            errors.append("Age must be between 0 and 120.")
    except (TypeError, ValueError):
        age = None
        errors.append("Age is required and must be a whole number.")
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
        age=age,
        sex=sex,
        address=address,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(producer)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not add this worker. Please try again."}), 500
    return jsonify(_serialize(producer)), 201


@producers_api_bp.route("/<int:producer_id>", methods=["PATCH"])
@login_required
def update_producer(producer_id):
    if not _authorized():
        return jsonify({"error": "Admin or encoder access only."}), 403
    producer = db.session.get(Producer, producer_id)
    if not producer:
        return jsonify({"error": "Worker not found."}), 404
    if current_user.role == "encoder" and producer.barangay.municipality_id != current_user.municipality_id:
        return jsonify({"error": "Worker is outside your municipality."}), 403

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
        if not address or len(address) > 255:
            errors.append("Address is required and must be 255 characters or fewer.")
        else:
            producer.address = address
    if "sex" in data:
        if data["sex"] not in ALLOWED_SEXES:
            errors.append("Sex must be Male, Female, or Other.")
        else:
            producer.sex = data["sex"]
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
        return jsonify({"error": "Could not update this worker. Please try again."}), 500
    return jsonify(_serialize(producer))


@producers_api_bp.route("/<int:producer_id>", methods=["DELETE"])
@login_required
def delete_producer(producer_id):
    if not _authorized():
        return jsonify({"error": "Admin or encoder access only."}), 403
    producer = db.session.get(Producer, producer_id)
    if not producer:
        return jsonify({"error": "Worker not found."}), 404
    if current_user.role == "encoder" and producer.barangay.municipality_id != current_user.municipality_id:
        return jsonify({"error": "Worker is outside your municipality."}), 403
    db.session.delete(producer)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not delete this worker. Please try again."}), 500
    return jsonify({"deleted": producer_id})