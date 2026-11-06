# WHAT: One-off importer for synthetic-masterlist.csv into the producers table.
# WHY: Hand-loading the synthetic master list is risky; a dry-run-first, idempotent
#      script keeps the load safe, repeatable, and easy to audit.

import argparse
import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.extensions import db
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.producer import Producer
from app.models.production_record import PRODUCTION_METHODS


# WHAT: Sex values the app accepts, mirroring producers_api.ALLOWED_SEXES.
ALLOWED_SEXES = {"Male", "Female", "Other"}

DEFAULT_CSV = Path(__file__).resolve().parents[1] / "synthetic-masterlist.csv"
BARANGAY_ALIASES = {
    ("bani", "garita"): "garrita",
    ("alaminos", "pangapisnan"): "pangapisan",
    ("anda", "macaleleng"): "macaleeng",
    ("dasol", "malakapas"): "malacapas",
    ("bani", "banog notre"): "banog norte",
}


def _clean(value):
    # WHAT: Trim and collapse internal whitespace so CSV stray spaces don't leak in.
    return " ".join((value or "").split())


def _header(value):
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", value.strip().lower())).strip("_")


def _norm(value):
    # WHAT: Case-insensitive match key for names.
    return _clean(value).lower()


def _norm_municipality(value):
    normalized = _norm(value)
    if normalized.startswith("city of "):
        normalized = normalized[len("city of "):]
    if normalized.endswith(" city"):
        normalized = normalized[:-len(" city")]
    return normalized


def load_rows(path):
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return [
            {_header(key): value for key, value in row.items() if key}
            for row in reader
        ]


def main():
    parser = argparse.ArgumentParser(description="Import the synthetic master list into producers.")
    parser.add_argument("csv", nargs="?", default=str(DEFAULT_CSV), help="Path to the master list CSV.")
    parser.add_argument("--commit", action="store_true", help="Write changes (default is a dry run).")
    args = parser.parse_args()

    rows = load_rows(Path(args.csv))

    app = create_app()
    with app.app_context():
        # WHAT: Reference maps so each CSV row resolves to an existing muni/barangay id.
        municipalities = {_norm_municipality(m.name): m for m in Municipality.query.all()}
        barangays = {
            (b.municipality_id, _norm(b.name)): b for b in Barangay.query.all()
        }
        existing = {
            (barangay_id, _norm(name))
            for barangay_id, name in db.session.query(Producer.barangay_id, Producer.name).all()
        }

        planned = []
        skipped = 0
        errors = []
        per_municipality = {}
        seen_csv = set()

        for line_no, row in enumerate(rows, start=2):
            municipality_name = _clean(row.get("municipality"))
            barangay_name = _clean(row.get("barangay"))
            first_name = _clean(row.get("first_name"))
            last_name = _clean(row.get("last_name"))
            name = _clean(row.get("name")) or _clean(f"{first_name} {last_name}")
            address = _clean(row.get("address"))
            raw_sex = _clean(row.get("sex"))
            sex_value = {"M": "Male", "F": "Female"}
            sex = sex_value.get(raw_sex.upper(), raw_sex.title()) if raw_sex else None
            raw_age = _clean(row.get("age"))
            raw_method = _clean(row.get("production_method") or row.get("method")).lower()
            production_method = raw_method or None

            municipality = municipalities.get(_norm_municipality(municipality_name))
            if not municipality:
                errors.append(f"line {line_no}: unknown municipality {municipality_name!r}")
                continue
            normalized_municipality = _norm_municipality(municipality_name)
            normalized_barangay = _norm(barangay_name)
            normalized_barangay = BARANGAY_ALIASES.get(
                (normalized_municipality, normalized_barangay), normalized_barangay
            )
            barangay = barangays.get((municipality.id, normalized_barangay))
            if not barangay:
                # WHY: Never auto-create barangays; unknown names must be resolved by hand.
                errors.append(f"line {line_no}: unknown barangay {barangay_name!r} in {municipality_name!r}")
                continue
            if sex is not None and sex not in ALLOWED_SEXES:
                errors.append(f"line {line_no}: invalid sex {sex!r}")
                continue
            if production_method is not None and production_method not in PRODUCTION_METHODS:
                errors.append(
                    f"line {line_no}: production_method must be one of "
                    f"{', '.join(PRODUCTION_METHODS)}"
                )
                continue
            if raw_age:
                try:
                    age = int(raw_age)
                    if age < 0 or age > 120:
                        raise ValueError
                except (TypeError, ValueError):
                    errors.append(f"line {line_no}: invalid age {raw_age!r}")
                    continue
            else:
                age = None
            if not name or len(name) > 150:
                errors.append(f"line {line_no}: invalid name for {barangay_name!r}")
                continue

            profile_fields = {
                "first_name": first_name or (name.split(maxsplit=1)[0] if name else None),
                "last_name": last_name or (name.split(maxsplit=1)[1] if len(name.split(maxsplit=1)) > 1 else None),
                "salt_farm_owner": _clean(row.get("name_of_salt_farm_owner")) or None,
                "designation": _clean(row.get("designation")) or None,
                "business_classification": _clean(row.get("business_classification")) or None,
                "contact_number": _clean(row.get("contact_no") or row.get("contact_number")) or None,
                "production_method": production_method,
            }
            field_limits = {
                "first_name": 100,
                "last_name": 100,
                "salt_farm_owner": 255,
                "designation": 100,
                "business_classification": 100,
                "contact_number": 32,
                "production_method": 20,
            }
            oversized = [
                field for field, value in profile_fields.items()
                if value and len(value) > field_limits[field]
            ]
            if oversized:
                errors.append(f"line {line_no}: profile field exceeds its limit ({', '.join(oversized)})")
                continue
            if address and len(address) > 255:
                errors.append(f"line {line_no}: address is too long for {name!r}")
                continue

            key = (barangay.id, _norm(name))
            if key in seen_csv or key in existing:
                skipped += 1
                continue
            seen_csv.add(key)
            planned.append(
                {
                    "barangay_id": barangay.id,
                    "name": name,
                    "age": age,
                    "sex": sex,
                    "address": address or None,
                    **profile_fields,
                }
            )
            per_municipality[municipality.name] = per_municipality.get(municipality.name, 0) + 1

        print(
            f"rows={len(rows)} to_insert={len(planned)} "
            f"skipped_existing_or_dupe={skipped} errors={len(errors)}"
        )
        for error in errors:
            print(f"  ERROR {error}")
        for name in sorted(per_municipality):
            print(f"  {name}: {per_municipality[name]}")

        if errors:
            print("Aborting: resolve the row errors above before committing.")
            return 1
        if not args.commit:
            print("DRY RUN - no writes. Re-run with --commit to insert.")
            return 0

        for item in planned:
            db.session.add(Producer(**item))
        try:
            # WHY: One transaction so a mid-insert failure rolls the whole import back.
            db.session.commit()
        except Exception:
            db.session.rollback()
            print("Commit failed; rolled back. Nothing was written.")
            raise
        print(f"Committed {len(planned)} producers.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
