# WHAT: One-off importer for synthetic-masterlist.csv into the producers table.
# WHY: Hand-loading the synthetic master list is risky; a dry-run-first, idempotent
#      script keeps the load safe, repeatable, and easy to audit.

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.extensions import db
from app.models.barangay import Barangay
from app.models.municipality import Municipality
from app.models.producer import Producer


# WHAT: Sex values the app accepts, mirroring producers_api.ALLOWED_SEXES.
ALLOWED_SEXES = {"Male", "Female", "Other"}

DEFAULT_CSV = Path(__file__).resolve().parents[1] / "synthetic-masterlist.csv"


def _clean(value):
    # WHAT: Trim and collapse internal whitespace so CSV stray spaces don't leak in.
    return " ".join((value or "").split())


def _norm(value):
    # WHAT: Case-insensitive match key for names.
    return _clean(value).lower()


def load_rows(path):
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def main():
    parser = argparse.ArgumentParser(description="Import the synthetic master list into producers.")
    parser.add_argument("csv", nargs="?", default=str(DEFAULT_CSV), help="Path to the master list CSV.")
    parser.add_argument("--commit", action="store_true", help="Write changes (default is a dry run).")
    args = parser.parse_args()

    rows = load_rows(Path(args.csv))

    app = create_app()
    with app.app_context():
        # WHAT: Reference maps so each CSV row resolves to an existing muni/barangay id.
        municipalities = {_norm(m.name): m for m in Municipality.query.all()}
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
            name = _clean(row.get("name"))
            address = _clean(row.get("address"))
            sex = _clean(row.get("sex"))
            raw_age = _clean(row.get("age"))

            municipality = municipalities.get(_norm(municipality_name))
            if not municipality:
                errors.append(f"line {line_no}: unknown municipality {municipality_name!r}")
                continue
            barangay = barangays.get((municipality.id, _norm(barangay_name)))
            if not barangay:
                # WHY: Never auto-create barangays; unknown names must be resolved by hand.
                errors.append(f"line {line_no}: unknown barangay {barangay_name!r} in {municipality_name!r}")
                continue
            if sex not in ALLOWED_SEXES:
                errors.append(f"line {line_no}: invalid sex {sex!r}")
                continue
            try:
                age = int(raw_age)
                if age < 0 or age > 120:
                    raise ValueError
            except (TypeError, ValueError):
                errors.append(f"line {line_no}: invalid age {raw_age!r}")
                continue
            if not name or len(name) > 150:
                errors.append(f"line {line_no}: invalid name for {barangay_name!r}")
                continue
            if not address or len(address) > 255:
                errors.append(f"line {line_no}: invalid address for {name!r}")
                continue

            key = (barangay.id, _norm(name))
            if key in seen_csv or key in existing:
                skipped += 1
                continue
            seen_csv.add(key)
            # WHY: age_bracket stays null — exact age is stored, matching create_producer
            #      and the encoder producer-report flow, which also leave it null.
            planned.append(
                {
                    "barangay_id": barangay.id,
                    "name": name,
                    "age": age,
                    "sex": sex,
                    "address": address,
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
