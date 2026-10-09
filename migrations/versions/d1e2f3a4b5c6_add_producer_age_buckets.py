"""add producer age-bucket columns to production_records

Revision ID: d1e2f3a4b5c6
Revises: c7d8e9f0a1b2
Create Date: 2026-09-04

Adds 5 producer age-bucket count columns, mirroring the existing
male_producers / female_producers pattern.

On the deployed (live) database these columns already exist, so this
migration is written idempotently: it is a no-op where the schema is
already present and still creates the columns on a fresh database.

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "d1e2f3a4b5c6"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None

AGE_COLUMNS = [
    "producers_18_30",
    "producers_31_40",
    "producers_41_50",
    "producers_51_60",
    "producers_61_plus",
]


def upgrade():
    for col in AGE_COLUMNS:
        op.execute(
            f"ALTER TABLE production_records "
            f"ADD COLUMN IF NOT EXISTS {col} INTEGER NOT NULL DEFAULT 0"
        )
        op.execute(
            f"DO $$ BEGIN "
            f"IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_{col}') "
            f"THEN ALTER TABLE production_records ADD CONSTRAINT chk_{col} "
            f"CHECK ({col} >= 0); END IF; END $$"
        )


def downgrade():
    for col in AGE_COLUMNS:
        op.drop_constraint(f"chk_{col}", "production_records", type_="check")
        op.drop_column("production_records", col)
