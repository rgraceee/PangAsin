"""Load the source-labeled municipality dataset without replacing submissions."""

import argparse
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from openpyxl import load_workbook

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app import create_app
from app.extensions import db
from app.models.municipality import Municipality
from app.models.municipality_production import MunicipalityMonthlyProduction


WORKBOOK_FILE = PROJECT_ROOT / "finally" / "Adjusted_Estimates.xlsx"
MONTHLY_SOURCE = "Adjusted_Estimates.xlsx"
EXPECTED_MONTHS = {2024: 12, 2025: 12, 2026: 9}
MONTH_NUMBERS = {
    name: month
    for month, name in enumerate(
        ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"),
        start=1,
    )
}


def _municipality_ids():
    municipalities = Municipality.query.all()
    by_name = {municipality.name.strip().casefold(): municipality.id for municipality in municipalities}
    return by_name


def _read_workbook_monthly_rows():
    workbook = load_workbook(WORKBOOK_FILE, read_only=True, data_only=True)
    try:
        rows = []
        sheet = workbook.active
        headers = {
            str(value).strip(): index
            for index, value in enumerate(next(sheet.iter_rows(values_only=True)))
            if value is not None
        }
        required_headers = {
            "Municipality",
            "Year",
            "Month",
            "Adjusted estimate (kg)",
        }
        missing_headers = required_headers - set(headers)
        if missing_headers:
            raise ValueError(
                "Adjusted_Estimates.xlsx is missing required columns: "
                + ", ".join(sorted(missing_headers))
            )

        for values in sheet.iter_rows(min_row=2, values_only=True):
            if not values or not values[headers["Municipality"]]:
                continue
            municipality = str(values[headers["Municipality"]]).strip()
            year_value = values[headers["Year"]]
            if not isinstance(year_value, (int, float)) or not float(year_value).is_integer():
                raise ValueError(f"Invalid year for {municipality}: {year_value!r}.")
            year = int(year_value)
            if year not in EXPECTED_MONTHS:
                raise ValueError(f"Unexpected workbook year for {municipality}: {year}.")

            month_value = values[headers["Month"]]
            month = MONTH_NUMBERS.get(str(month_value).strip())
            production = values[headers["Adjusted estimate (kg)"]]
            if month is None or production is None:
                raise ValueError(
                    f"Incomplete workbook row for {municipality}, "
                    f"{year}-{month_value}."
                )
            production_value = Decimal(str(production))
            if not production_value.is_finite() or production_value < 0:
                raise ValueError(
                    f"Invalid production value for {municipality}, "
                    f"{year}-{month_value}: {production!r}."
                )
            if month > EXPECTED_MONTHS[year]:
                raise ValueError(f"Unexpected workbook period: {year}-{month}.")
            rows.append({
                "municipality": municipality,
                "year": str(year),
                "month_number": str(month),
                "monthly_production_kg": str(
                    production_value.quantize(Decimal("0.000001"))
                ),
                "basis": "Adjusted estimate (kg) from Adjusted_Estimates.xlsx",
            })
    finally:
        workbook.close()

    totals = defaultdict(Decimal)
    months = defaultdict(set)
    keys = set()
    for row in rows:
        name = row["municipality"]
        year = int(row["year"])
        month = int(row["month_number"])
        if year not in EXPECTED_MONTHS or not 1 <= month <= EXPECTED_MONTHS[year]:
            raise ValueError(f"Unexpected workbook period: {name}, {year}-{month}.")
        key = (name, year, month)
        if key in keys:
            raise ValueError(f"Duplicate workbook production row: {key}.")
        keys.add(key)
        totals[(name, year)] += Decimal(row["monthly_production_kg"])
        months[(name, year)].add(month)

    if len(rows) != 231:
        raise ValueError(f"Expected 231 workbook production rows, found {len(rows)}.")
    municipalities = {name for name, _ in months}
    if len(municipalities) != 7:
        raise ValueError(f"Expected 7 workbook municipalities, found {len(municipalities)}.")
    if set(months) != {
        (name, year)
        for name in municipalities
        for year in EXPECTED_MONTHS
    }:
        raise ValueError("Workbook municipality/year combinations are incomplete.")
    for name in municipalities:
        for year, expected_month_count in EXPECTED_MONTHS.items():
            if len(months[(str(name).strip(), year)]) != expected_month_count:
                raise ValueError(f"{name} {year} has an incomplete workbook monthly series.")

    return rows


def import_workbook_production(dry_run=False, year=None):
    rows = _read_workbook_monthly_rows()
    if year is not None:
        rows = [row for row in rows if int(row["year"]) == year]
    municipality_ids = _municipality_ids()
    missing = {
        row["municipality"] for row in rows
        if row["municipality"].casefold() not in municipality_ids
    }
    if missing:
        raise ValueError(
            "Municipality names are missing from the database: "
            + ", ".join(sorted(missing))
        )

    existing_rows = MunicipalityMonthlyProduction.query.all()
    existing = {
        (row.municipality_id, row.production_year, row.production_month): row
        for row in existing_rows
    }
    expected_keys = {
        (
            municipality_ids[row["municipality"].casefold()],
            int(row["year"]),
            int(row["month_number"]),
        )
        for row in rows
    }
    unexpected_existing = set(existing) - expected_keys
    if unexpected_existing:
        raise ValueError(
            "The production table contains records outside the replacement dataset; "
            "no changes were made."
        )

    updated = 0
    inserted = 0
    for row in rows:
        municipality_id = municipality_ids[row["municipality"].casefold()]
        production_year = int(row["year"])
        month = int(row["month_number"])
        production = existing.get((municipality_id, production_year, month))
        values = {
            "production_kg": Decimal(row["monthly_production_kg"]),
            "source_label": MONTHLY_SOURCE,
            "basis": row["basis"],
            "is_synthetic": False,
        }
        if production is None:
            production = MunicipalityMonthlyProduction(
                municipality_id=municipality_id,
                production_year=production_year,
                production_month=month,
                **values,
            )
            db.session.add(production)
            inserted += 1
        else:
            for field, value in values.items():
                setattr(production, field, value)
            updated += 1

    if dry_run:
        db.session.rollback()
    else:
        db.session.commit()

    return {
        "workbook_rows": len(rows),
        "years": sorted({int(row["year"]) for row in rows}),
        "monthly_inserted": inserted,
        "monthly_updated": updated,
        "dry_run": dry_run,
        "source": WORKBOOK_FILE.name,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate source data and show the planned upsert counts without writing.",
    )
    parser.add_argument(
        "--workbook-year",
        type=int,
        choices=(2024, 2025, 2026),
        help="Import one workbook production year only.",
    )
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        result = import_workbook_production(
            dry_run=args.dry_run,
            year=args.workbook_year,
        )
    print(
        "Municipality production data import "
        + ("validated (dry run): " if args.dry_run else "completed: ")
        + ", ".join(f"{key}={value}" for key, value in result.items())
    )


if __name__ == "__main__":
    main()
