# WHAT: Validation and storage for uploaded municipality boundaries.
# WHY: Admins should not have to hand-edit files under app/static/geojson, and
#      uploaded data must never escape that directory or store invalid JSON.
import json
import os

from flask import current_app

from app.services.municipality_service import MunicipalityValidationError, slugify


def _geojson_dir():
    return os.path.join(current_app.root_path, "static", "geojson")


def geojson_path(ref):
    """Resolve a stored ``geojson/<slug>.json`` reference to a safe path."""
    return os.path.join(_geojson_dir(), os.path.basename(ref or ""))


def _walk_coordinates(value):
    if isinstance(value, (list, tuple)):
        if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
            lng, lat = value[0], value[1]
            if not (-180 <= lng <= 180 and -90 <= lat <= 90):
                raise MunicipalityValidationError(
                    ["GeoJSON coordinates are outside the valid longitude/latitude range."]
                )
            return
        for item in value:
            _walk_coordinates(item)


def _normalize_geometry(geometry):
    if not isinstance(geometry, dict):
        raise MunicipalityValidationError(["GeoJSON geometry must be an object."])
    if geometry.get("type") not in ("Polygon", "MultiPolygon"):
        raise MunicipalityValidationError(
            ["Only Polygon or MultiPolygon boundaries can be uploaded."]
        )
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, (list, tuple)) or not coordinates:
        raise MunicipalityValidationError(["GeoJSON geometry has no coordinates."])
    _walk_coordinates(coordinates)
    return geometry


def _normalize_payload(payload):
    if not isinstance(payload, dict):
        raise MunicipalityValidationError(["GeoJSON root must be an object."])

    kind = payload.get("type")
    if kind == "FeatureCollection":
        features = payload.get("features")
        if not isinstance(features, list) or not features:
            raise MunicipalityValidationError(
                ["FeatureCollection must contain at least one feature."]
            )
    elif kind == "Feature":
        features = [payload]
    elif kind in ("Polygon", "MultiPolygon"):
        features = [{"type": "Feature", "properties": {}, "geometry": payload}]
    else:
        raise MunicipalityValidationError(
            ["GeoJSON must be a FeatureCollection, Feature, Polygon, or MultiPolygon."]
        )

    normalized_features = []
    for index, feature in enumerate(features):
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise MunicipalityValidationError(
                [f"Feature #{index + 1} is not a valid GeoJSON Feature."]
            )
        normalized_features.append(
            {
                "type": "Feature",
                "properties": feature.get("properties") or {},
                "geometry": _normalize_geometry(feature.get("geometry")),
            }
        )

    return {"type": "FeatureCollection", "features": normalized_features}


def save_municipality_geojson(municipality, file_storage):
    """Validate an uploaded file and save it as ``geojson/<slug>.json``.

    Returns ``(relative_ref, feature_count)``. The caller commits the
    municipality row after this function returns.
    """
    if file_storage is None or not getattr(file_storage, "filename", ""):
        raise MunicipalityValidationError(["A .json or .geojson file is required."])

    filename = file_storage.filename.lower()
    if not filename.endswith((".json", ".geojson")):
        raise MunicipalityValidationError(
            ["Only .json and .geojson files are accepted."]
        )

    max_bytes = current_app.config.get("MAX_GEOJSON_BYTES", 5 * 1024 * 1024)
    raw = file_storage.read()
    if not raw:
        raise MunicipalityValidationError(["The uploaded file is empty."])
    if len(raw) > max_bytes:
        raise MunicipalityValidationError(
            [f"The uploaded file is larger than {max_bytes // (1024 * 1024)} MB."]
        )

    try:
        payload = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise MunicipalityValidationError([f"The file is not valid JSON: {exc}"])

    normalized = _normalize_payload(payload)
    slug = slugify(municipality.name)
    if not slug:
        raise MunicipalityValidationError(
            ["The municipality name cannot produce a safe GeoJSON filename."]
        )

    directory = _geojson_dir()
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, f"{slug}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(normalized, handle, ensure_ascii=False, separators=(",", ":"))

    return f"geojson/{slug}.json", len(normalized["features"])
