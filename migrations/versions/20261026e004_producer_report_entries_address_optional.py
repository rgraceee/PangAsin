"""Ensure producer_report_entries.address accepts NULL.

Revision ID: 20261026e004
Revises: 20261026e003
Create Date: 2026-10-26

WHY: 20261026e001 already dropped NOT NULL on this column, but the constraint
     is still present on databases where that revision was stamped without
     applying. Re-running the alter is a no-op when the column is already
     nullable, so this revision safely repairs those databases. The encoder
     form no longer sends a home address, and a NOT NULL column blocks every
     Salt Farmer report submission.
"""
from alembic import op
import sqlalchemy as sa


revision = "20261026e004"
down_revision = "20261026e003"
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
