"""Make producer_report_entries.address optional.

Revision ID: 20261026e001
Revises: 20261009e001
Create Date: 2026-10-26
"""
from alembic import op
import sqlalchemy as sa


revision = "20261026e001"
down_revision = "20261009e001"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "producer_report_entries",
        "address",
        existing_type=sa.String(length=255),
        nullable=True,
    )


def downgrade():
    # There is no address to restore; use an empty string so the NOT NULL
    # constraint can be re-applied.
    op.execute("UPDATE producer_report_entries SET address = '' WHERE address IS NULL")
    op.alter_column(
        "producer_report_entries",
        "address",
        existing_type=sa.String(length=255),
        nullable=False,
    )