"""encoder schema: barangays reference table + production_records rework

Revision ID: 0002_encoder_barangay_schema
Revises: 0001_baseline
Create Date: 2026-09-02

Rework ``production_records`` for the Encoder (BFAR Municipal Coordinator) role:

- New ``barangays`` reference table (id, municipality_id FK, name unique per municipality).
- ``production_records.barangay`` (free text) -> ``barangay_id`` FK.
- Add ``registered_producers`` / ``male_producers`` / ``female_producers``.
- Add ``area_per_salt_bed`` (numeric, m2); derived from ``production_area / num_salt_beds``
  where beds > 0, left NULL otherwise.
- Drop ``producer_age`` / ``producer_gender`` / ``period_type`` / ``production_method`` /
  ``production_area`` / ``barangay``.
- Uniqueness becomes ``(municipality_id, barangay_id, record_date)``.

NOTES
- This migration is fully self-contained: the per-municipality barangay list is
  inlined below so fresh setups do not depend on ``app/data/barangays.py``.
- The barangay backfill unions the inlined list with any distinct ``barangay``
  strings already present in ``production_records``.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_encoder_barangay_schema"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

# Inlined copy of the salt-producing barangay reference data (was app/data/barangays.py).
SALT_BARANGAYS = {
    "Bolinao": [
        "Victory",
        "Pilar",
        "Zaragoza",
    ],
    "Anda": [
        "Sablig",
        "Macaleeng",
        "Tondol",
    ],
    "Alaminos": [
        "Bolaney",
        "Bisocol",
        "Pangapisan",
        "Mona",
        "Cayucay",
        "Baleyadaan",
        "Lucap",
        "Bued",
        "Sabangan",
        "Pandan",
        "Telbang",
        "Victoria",
    ],
    "Bani": [
        "Banog Norte",
        "San Miguel",
    ],
    "San Fabian": [
        "Tiblong",
        "Bolasi",
        "Longos",
    ],
    "Dasol": [
        "Gais-Guipe",
        "Hermosa",
        "Magsaysay",
        "Malacapas",
        "Amalbalan",
        "Uli",
        "Bobonot",
    ],
    "Infanta": [
        "Bamban",
        "Batang",
        "Bayambang",
        "Cato",
        "Doliman",
        "Fatima",
        "Maya",
        "Nangalisan",
        "Nayom",
        "Pita",
        "Poblacion",
        "Potol",
        "Babuyan",
    ],
}


def upgrade():
    conn = op.get_bind()

    op.create_table(
        "barangays",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "municipality_id",
            sa.Integer(),
            sa.ForeignKey("municipalities.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "municipality_id", "name", name="uq_barangays_municipality_name"
        ),
    )

    # 1. Backfill barangays from the inlined reference list, scoped per municipality.
    muni_ids = {name: muni_id for name, muni_id in conn.execute(
        sa.text("SELECT name, id FROM municipalities")
    )}
    for muni_name, names in SALT_BARANGAYS.items():
        muni_id = muni_ids.get(muni_name)
        if muni_id is None:
            print(f"[0002] WARNING: municipality {muni_name!r} not found; skipping its barangays.")
            continue
        for name in names:
            conn.execute(
                sa.text(
                    "INSERT INTO barangays (municipality_id, name, created_at, updated_at) "
                    "VALUES (:mid, :name, now(), now()) "
                    "ON CONFLICT (municipality_id, name) DO NOTHING"
                ).params(mid=muni_id, name=name)
            )

    # 2. Backfill barangays from any distinct free-text barangay strings already
    #    recorded in production_records (covers values not present in the reference list).
    op.execute(
        sa.text(
            "INSERT INTO barangays (municipality_id, name, created_at, updated_at) "
            "SELECT DISTINCT r.municipality_id, r.barangay, now(), now() "
            "FROM production_records r "
            "ON CONFLICT (municipality_id, name) DO NOTHING"
        )
    )

    # 3. Add barangay_id, backfill from the migrated names, verify, then make NOT NULL.
    op.add_column(
        "production_records",
        sa.Column("barangay_id", sa.Integer(), sa.ForeignKey("barangays.id"), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE production_records r SET barangay_id = b.id "
            "FROM barangays b "
            "WHERE b.municipality_id = r.municipality_id AND b.name = r.barangay"
        )
    )
    unmapped = conn.execute(
        sa.text(
            "SELECT id, municipality_id, barangay, record_date "
            "FROM production_records WHERE barangay_id IS NULL"
        )
    ).fetchall()
    if unmapped:
        raise RuntimeError(
            "Failed to map barangay strings to barangays table: " + str(unmapped)
        )
    op.alter_column("production_records", "barangay_id", nullable=False)
    op.create_index(
        "ix_production_records_barangay_id", "production_records", ["barangay_id"]
    )

    # 4. Add the new producer/salt-bed columns.
    op.add_column(
        "production_records",
        sa.Column("registered_producers", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "production_records",
        sa.Column("male_producers", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "production_records",
        sa.Column("female_producers", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "production_records",
        sa.Column("area_per_salt_bed", sa.Numeric(10, 2), nullable=True),
    )

    # 5. Backfill area_per_salt_bed (m2) from total production area / beds, guarding
    #    against zero/missing bed counts; list any rows left NULL in the migration log.
    op.execute(
        sa.text(
            "UPDATE production_records "
            "SET area_per_salt_bed = ROUND(CAST(production_area AS numeric) / num_salt_beds, 2) "
            "WHERE num_salt_beds > 0"
        )
    )
    skipped = conn.execute(
        sa.text(
            "SELECT id, municipality_id, barangay, record_date, production_area, num_salt_beds "
            "FROM production_records WHERE num_salt_beds IS NULL OR num_salt_beds <= 0"
        )
    ).fetchall()
    if skipped:
        print("[0002] area_per_salt_bed left NULL (no/missing salt beds) for records:")
        for row in skipped:
            print("    ", row)
    else:
        print("[0002] area_per_salt_bed backfilled for all records (0 rows skipped).")

    # 6. Drop constraints that reference columns being removed.
    op.drop_constraint("chk_production_area", "production_records", type_="check")
    op.drop_constraint("chk_producer_age", "production_records", type_="check")
    op.drop_constraint("uq_production_records_composite", "production_records", type_="unique")

    # 7. Defensive duplicate check before installing the new uniqueness rule.
    dupes = conn.execute(
        sa.text(
            "SELECT municipality_id, barangay_id, record_date "
            "FROM production_records GROUP BY 1, 2, 3 HAVING count(*) > 1"
        )
    ).fetchall()
    if dupes:
        raise RuntimeError(
            "Duplicate (municipality_id, barangay_id, record_date) rows exist: " + str(dupes)
        )
    op.create_unique_constraint(
        "uq_production_records_barangay_date",
        "production_records",
        ["municipality_id", "barangay_id", "record_date"],
    )

    # 8. New check constraints for the added columns.
    op.create_check_constraint("chk_registered_producers", "production_records", "registered_producers >= 0")
    op.create_check_constraint("chk_male_producers", "production_records", "male_producers >= 0")
    op.create_check_constraint("chk_female_producers", "production_records", "female_producers >= 0")
    op.create_check_constraint(
        "chk_area_per_salt_bed",
        "production_records",
        "area_per_salt_bed IS NULL OR area_per_salt_bed >= 0",
    )

    # 9. Drop the legacy columns and now-orphaned enum types.
    op.drop_column("production_records", "production_area")
    op.drop_column("production_records", "producer_age")
    op.drop_column("production_records", "producer_gender")
    op.drop_column("production_records", "period_type")
    op.drop_column("production_records", "production_method")
    op.drop_column("production_records", "barangay")

    op.execute(sa.text("DROP TYPE IF EXISTS period_type_enum"))
    op.execute(sa.text("DROP TYPE IF EXISTS production_method_enum"))
    op.execute(sa.text("DROP TYPE IF EXISTS producer_gender_enum"))


def downgrade():
    """Best-effort reversal: schema is restored but dropped-column data is lost."""
    conn = op.get_bind()

    op.add_column(
        "production_records",
        sa.Column("barangay", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "production_records",
        sa.Column(
            "period_type",
            sa.Enum("daily", "monthly", "annual", name="period_type_enum"),
            nullable=True,
        ),
    )
    op.add_column(
        "production_records",
        sa.Column(
            "production_method",
            sa.Enum("solar_evaporation", "cooked", "hybrid", name="production_method_enum"),
            nullable=True,
        ),
    )
    op.add_column(
        "production_records",
        sa.Column("production_area", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "production_records",
        sa.Column("producer_age", sa.SmallInteger(), nullable=True),
    )
    op.add_column(
        "production_records",
        sa.Column(
            "producer_gender",
            sa.Enum("male", "female", name="producer_gender_enum"),
            nullable=True,
        ),
    )

    conn.execute(
        sa.text(
            "UPDATE production_records r "
            "SET barangay = b.name, "
            "    period_type = 'monthly', "
            "    production_method = 'solar_evaporation', "
            "    production_area = CASE WHEN r.num_salt_beds > 0 "
            "          THEN ROUND(CAST(r.num_salt_beds * COALESCE(r.area_per_salt_bed, 0) AS numeric), 2) "
            "          ELSE NULL END "
            "FROM barangays b WHERE b.id = r.barangay_id"
        )
    )

    op.alter_column("production_records", "barangay", nullable=False)
    op.alter_column("production_records", "period_type", nullable=False)
    op.alter_column("production_records", "production_method", nullable=False)
    op.alter_column("production_records", "production_area", nullable=False)

    op.drop_constraint("uq_production_records_barangay_date", "production_records", type_="unique")
    op.drop_constraint("chk_registered_producers", "production_records", type_="check")
    op.drop_constraint("chk_male_producers", "production_records", type_="check")
    op.drop_constraint("chk_female_producers", "production_records", type_="check")
    op.drop_constraint("chk_area_per_salt_bed", "production_records", type_="check")

    op.create_unique_constraint(
        "uq_production_records_composite",
        "production_records",
        ["municipality_id", "barangay", "period_type", "record_date"],
    )
    op.create_check_constraint("chk_production_area", "production_records", "production_area > 0")
    op.create_check_constraint(
        "chk_producer_age",
        "production_records",
        "producer_age IS NULL OR (producer_age >= 15 AND producer_age <= 100)",
    )

    op.drop_column("production_records", "area_per_salt_bed")
    op.drop_column("production_records", "registered_producers")
    op.drop_column("production_records", "male_producers")
    op.drop_column("production_records", "female_producers")
    op.drop_column("production_records", "barangay_id")

    op.execute(sa.text("DROP TABLE IF EXISTS barangays"))