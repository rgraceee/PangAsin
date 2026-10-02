"""Add standalone producer reports.

Revision ID: 20261002e002
Revises: 20261002e001
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261002e002"
down_revision = "20261002e001"
branch_labels = None
depends_on = None


producer_report_status = postgresql.ENUM(
    "draft",
    "pending",
    "approved",
    "rejected",
    "returned",
    name="producer_report_status_enum",
    create_type=False,
)


def upgrade():
    bind = op.get_bind()
    producer_report_status.create(bind, checkfirst=True)
    op.create_table(
        "producer_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("municipality_id", sa.Integer(), nullable=False),
        sa.Column("submitted_by", sa.Integer(), nullable=False),
        sa.Column("status", producer_report_status, nullable=False),
        sa.Column("reviewer_comment", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["municipality_id"], ["municipalities.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_producer_reports_municipality_id", "producer_reports", ["municipality_id"])

    op.create_table(
        "producer_report_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("barangay_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("age_bracket", sa.String(length=16), nullable=False),
        sa.Column("sex", sa.String(length=20), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["barangay_id"], ["barangays.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["report_id"], ["producer_reports.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_producer_report_entries_barangay_id", "producer_report_entries", ["barangay_id"])
    op.create_index("ix_producer_report_entries_report_id", "producer_report_entries", ["report_id"])


def downgrade():
    op.drop_index("ix_producer_report_entries_report_id", table_name="producer_report_entries")
    op.drop_index("ix_producer_report_entries_barangay_id", table_name="producer_report_entries")
    op.drop_table("producer_report_entries")
    op.drop_index("ix_producer_reports_municipality_id", table_name="producer_reports")
    op.drop_table("producer_reports")
    producer_report_status.drop(op.get_bind(), checkfirst=True)
