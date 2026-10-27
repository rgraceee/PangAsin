"""rename municipality estimate tables to neutral production names

Revision ID: 20261026e001
Revises: 20261015e001
"""

from alembic import op


revision = "20261026e001"
down_revision = "20261015e001"
branch_labels = None
depends_on = None


def _rename_constraint(table, old_name, new_name):
    op.execute(
        f'ALTER TABLE "{table}" RENAME CONSTRAINT "{old_name}" TO "{new_name}"'
    )


def upgrade():
    op.rename_table(
        "municipality_monthly_estimates",
        "municipality_monthly_production",
    )
    op.alter_column(
        "municipality_monthly_production",
        "estimate_year",
        new_column_name="production_year",
    )
    op.alter_column(
        "municipality_monthly_production",
        "estimate_month",
        new_column_name="production_month",
    )
    _rename_constraint(
        "municipality_monthly_production",
        "uq_municipality_monthly_estimate_period",
        "uq_municipality_monthly_production_period",
    )
    _rename_constraint(
        "municipality_monthly_production",
        "chk_estimate_month",
        "chk_production_month",
    )
    _rename_constraint(
        "municipality_monthly_production",
        "chk_estimate_production_kg",
        "chk_production_kg",
    )
    _rename_constraint(
        "municipality_monthly_production",
        "municipality_monthly_estimates_municipality_id_fkey",
        "municipality_monthly_production_municipality_id_fkey",
    )
    op.execute(
        "ALTER INDEX ix_municipality_monthly_estimates_period "
        "RENAME TO ix_municipality_monthly_production_period"
    )

    op.rename_table(
        "municipality_salt_bed_estimates",
        "municipality_salt_bed_data",
    )
    op.alter_column(
        "municipality_salt_bed_data",
        "estimate_year",
        new_column_name="data_year",
    )
    op.alter_column(
        "municipality_salt_bed_data",
        "estimated_beds",
        new_column_name="bed_count",
    )
    _rename_constraint(
        "municipality_salt_bed_data",
        "uq_municipality_salt_bed_estimate_year",
        "uq_municipality_salt_bed_data_year",
    )
    _rename_constraint(
        "municipality_salt_bed_data",
        "chk_estimated_beds",
        "chk_bed_count",
    )
    _rename_constraint(
        "municipality_salt_bed_data",
        "municipality_salt_bed_estimates_municipality_id_fkey",
        "municipality_salt_bed_data_municipality_id_fkey",
    )
    op.execute(
        "UPDATE forecast_runs "
        "SET data_source = 'municipality_production' "
        "WHERE data_source = 'municipality_estimates'"
    )


def downgrade():
    op.execute(
        "UPDATE forecast_runs "
        "SET data_source = 'municipality_estimates' "
        "WHERE data_source = 'municipality_production'"
    )
    _rename_constraint(
        "municipality_salt_bed_data",
        "municipality_salt_bed_data_municipality_id_fkey",
        "municipality_salt_bed_estimates_municipality_id_fkey",
    )
    _rename_constraint(
        "municipality_salt_bed_data",
        "chk_bed_count",
        "chk_estimated_beds",
    )
    _rename_constraint(
        "municipality_salt_bed_data",
        "uq_municipality_salt_bed_data_year",
        "uq_municipality_salt_bed_estimate_year",
    )
    op.alter_column(
        "municipality_salt_bed_data",
        "bed_count",
        new_column_name="estimated_beds",
    )
    op.alter_column(
        "municipality_salt_bed_data",
        "data_year",
        new_column_name="estimate_year",
    )
    op.rename_table(
        "municipality_salt_bed_data",
        "municipality_salt_bed_estimates",
    )

    op.execute(
        "ALTER INDEX ix_municipality_monthly_production_period "
        "RENAME TO ix_municipality_monthly_estimates_period"
    )
    _rename_constraint(
        "municipality_monthly_production",
        "municipality_monthly_production_municipality_id_fkey",
        "municipality_monthly_estimates_municipality_id_fkey",
    )
    _rename_constraint(
        "municipality_monthly_production",
        "chk_production_kg",
        "chk_estimate_production_kg",
    )
    _rename_constraint(
        "municipality_monthly_production",
        "chk_production_month",
        "chk_estimate_month",
    )
    _rename_constraint(
        "municipality_monthly_production",
        "uq_municipality_monthly_production_period",
        "uq_municipality_monthly_estimate_period",
    )
    op.alter_column(
        "municipality_monthly_production",
        "production_month",
        new_column_name="estimate_month",
    )
    op.alter_column(
        "municipality_monthly_production",
        "production_year",
        new_column_name="estimate_year",
    )
    op.rename_table(
        "municipality_monthly_production",
        "municipality_monthly_estimates",
    )
