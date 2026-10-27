"""add municipality estimate datasets and forecast source tracking

Revision ID: 20261015e001
Revises: 20261015e000
"""

from alembic import op
import sqlalchemy as sa


revision = "20261015e001"
down_revision = "20261015e000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "municipality_monthly_estimates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("municipality_id", sa.Integer(), nullable=False),
        sa.Column("estimate_year", sa.Integer(), nullable=False),
        sa.Column("estimate_month", sa.Integer(), nullable=False),
        sa.Column("production_kg", sa.Numeric(16, 6), nullable=False),
        sa.Column("source_label", sa.String(length=255), nullable=False),
        sa.Column("basis", sa.Text(), nullable=False),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "estimate_month BETWEEN 1 AND 12", name="chk_estimate_month"
        ),
        sa.CheckConstraint(
            "production_kg >= 0", name="chk_estimate_production_kg"
        ),
        sa.ForeignKeyConstraint(
            ["municipality_id"],
            ["municipalities.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "municipality_id",
            "estimate_year",
            "estimate_month",
            name="uq_municipality_monthly_estimate_period",
        ),
    )
    op.create_index(
        "ix_municipality_monthly_estimates_period",
        "municipality_monthly_estimates",
        ["estimate_year", "estimate_month"],
    )
    op.create_table(
        "municipality_salt_bed_estimates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("municipality_id", sa.Integer(), nullable=False),
        sa.Column("estimate_year", sa.Integer(), nullable=False),
        sa.Column("annual_production_kg", sa.Numeric(16, 6), nullable=False),
        sa.Column("production_source", sa.String(length=100), nullable=False),
        sa.Column("estimated_beds", sa.Numeric(14, 6), nullable=False),
        sa.Column("sensitivity_low_beds", sa.Numeric(14, 6), nullable=False),
        sa.Column("sensitivity_high_beds", sa.Numeric(14, 6), nullable=False),
        sa.Column(
            "implied_beds_using_2024_output",
            sa.Numeric(14, 6),
            nullable=True,
        ),
        sa.Column("legacy_beds_estimate", sa.Numeric(14, 6), nullable=True),
        sa.Column("area_based_literal_count", sa.Numeric(14, 6), nullable=True),
        sa.Column("confidence_and_notes", sa.Text(), nullable=False),
        sa.Column("source_label", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "annual_production_kg >= 0", name="chk_bed_production_kg"
        ),
        sa.CheckConstraint("estimated_beds >= 0", name="chk_estimated_beds"),
        sa.CheckConstraint(
            "sensitivity_low_beds >= 0", name="chk_sensitivity_low_beds"
        ),
        sa.CheckConstraint(
            "sensitivity_high_beds >= sensitivity_low_beds",
            name="chk_sensitivity_bed_range",
        ),
        sa.ForeignKeyConstraint(
            ["municipality_id"],
            ["municipalities.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "municipality_id",
            "estimate_year",
            name="uq_municipality_salt_bed_estimate_year",
        ),
    )
    op.add_column(
        "forecast_runs",
        sa.Column(
            "data_source",
            sa.String(length=40),
            nullable=False,
            server_default="approved_records",
        ),
    )
    op.alter_column("forecast_runs", "data_source", server_default=None)


def downgrade():
    op.drop_column("forecast_runs", "data_source")
    op.drop_table("municipality_salt_bed_estimates")
    op.drop_index(
        "ix_municipality_monthly_estimates_period",
        table_name="municipality_monthly_estimates",
    )
    op.drop_table("municipality_monthly_estimates")
