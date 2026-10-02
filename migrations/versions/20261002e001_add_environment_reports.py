"""Add Environment reports.

Revision ID: 20261002e001
Revises:
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261002e001"
down_revision = "4f5a6b7c8d9e"
branch_labels = None
depends_on = None


environment_report_status = postgresql.ENUM(
    "draft",
    "pending",
    "approved",
    "rejected",
    "returned",
    name="environment_report_status_enum",
    create_type=False,
)


def upgrade():
    bind = op.get_bind()
    environment_report_status.create(bind, checkfirst=True)
    op.create_table(
        "environment_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("municipality_id", sa.Integer(), nullable=False),
        sa.Column("barangay_id", sa.Integer(), nullable=False),
        sa.Column("num_salt_beds", sa.Integer(), nullable=False),
        sa.Column("area_per_salt_bed", sa.Numeric(10, 2), nullable=False),
        sa.Column("production_methods", sa.JSON(), nullable=False),
        sa.Column("production_area_size", sa.Numeric(14, 2), nullable=False),
        sa.Column("submitted_by", sa.Integer(), nullable=False),
        sa.Column("status", environment_report_status, nullable=False),
        sa.Column("reviewer_comment", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("num_salt_beds > 0", name="chk_environment_salt_beds"),
        sa.CheckConstraint("area_per_salt_bed >= 0", name="chk_environment_area_per_bed"),
        sa.CheckConstraint("production_area_size >= 0", name="chk_environment_production_area"),
        sa.ForeignKeyConstraint(["barangay_id"], ["barangays.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["municipality_id"], ["municipalities.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_environment_reports_barangay_id",
        "environment_reports",
        ["barangay_id"],
    )
    op.create_index(
        "ix_environment_reports_municipality_id",
        "environment_reports",
        ["municipality_id"],
    )


def downgrade():
    op.drop_index("ix_environment_reports_municipality_id", table_name="environment_reports")
    op.drop_index("ix_environment_reports_barangay_id", table_name="environment_reports")
    op.drop_table("environment_reports")
    environment_report_status.drop(op.get_bind(), checkfirst=True)