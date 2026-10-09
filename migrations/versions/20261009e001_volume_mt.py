"""convert salt production volumes from kg to metric tons (MT)

Revision ID: 20261009e001
Revises: 20261002e006
Create Date: 2026-10-09

WHAT: Ginagawang metric tons (MT) ang lahat ng naka-imbak na volume na
      dating kilograms, sa pamamagitan ng paghati sa 1000.
WHY:  Isang unit lang ang dapat gamitin sa buong system. Ang pagpapalawak
      ng precision (...,5) ay ginagawang eksakto ang kg -> MT conversion
      at ang downgrade (MT -> kg, x1000) ay naibabalik ang orihinal.

Columns converted:
- production_records.production_volume -> production_volume_mt
- forecast_points.predicted_value / lower_bound / upper_bound
- forecast_runs.projected_total / mae / rmse (pareho ang unit sa volume)
"""
from alembic import op
import sqlalchemy as sa


revision = "20261009e001"
down_revision = "20261002e006"
branch_labels = None
depends_on = None


def upgrade():
    # production_records: rename + widen precision + convert kg -> MT.
    op.alter_column(
        "production_records", "production_volume",
        new_column_name="production_volume_mt",
    )
    op.alter_column(
        "production_records", "production_volume_mt",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Numeric(12, 5),
        existing_nullable=False,
        postgresql_using="production_volume_mt / 1000.0",
    )
    op.drop_constraint("chk_production_volume", "production_records", type_="check")
    op.create_check_constraint(
        "chk_production_volume_mt", "production_records", "production_volume_mt >= 0"
    )

    # forecast_points: convert kg -> MT.
    for column in ("predicted_value", "lower_bound", "upper_bound"):
        op.alter_column(
            "forecast_points", column,
            existing_type=sa.Numeric(14, 2),
            type_=sa.Numeric(14, 5),
            existing_nullable=True,
            postgresql_using=f"{column} / 1000.0",
        )

    # forecast_runs: convert kg -> MT (mae/rmse share the volume unit).
    for column in ("projected_total", "mae", "rmse"):
        op.alter_column(
            "forecast_runs", column,
            existing_type=sa.Numeric(14, 2),
            type_=sa.Numeric(14, 5),
            existing_nullable=True,
            postgresql_using=f"{column} / 1000.0",
        )


def downgrade():
    # forecast_runs: convert MT -> kg.
    for column in ("projected_total", "mae", "rmse"):
        op.alter_column(
            "forecast_runs", column,
            existing_type=sa.Numeric(14, 5),
            type_=sa.Numeric(14, 2),
            existing_nullable=True,
            postgresql_using=f"{column} * 1000.0",
        )

    # forecast_points: convert MT -> kg.
    for column in ("predicted_value", "lower_bound", "upper_bound"):
        op.alter_column(
            "forecast_points", column,
            existing_type=sa.Numeric(14, 5),
            type_=sa.Numeric(14, 2),
            existing_nullable=True,
            postgresql_using=f"{column} * 1000.0",
        )

    # production_records: convert MT -> kg, then restore name/constraint.
    op.alter_column(
        "production_records", "production_volume_mt",
        existing_type=sa.Numeric(12, 5),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
        postgresql_using="production_volume_mt * 1000.0",
    )
    op.drop_constraint("chk_production_volume_mt", "production_records", type_="check")
    op.alter_column(
        "production_records", "production_volume_mt",
        new_column_name="production_volume",
    )
    op.create_check_constraint(
        "chk_production_volume", "production_records", "production_volume >= 0"
    )
