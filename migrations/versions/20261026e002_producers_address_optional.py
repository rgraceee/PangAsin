"""Make producers.address optional.

Revision ID: 20261026e002
Revises: 20261026e001
Create Date: 2026-10-26

WHY: The Producer Report form no longer collects a Home Address, and
approving a report copies its entries into the producers master list.
producers.address must therefore accept NULL.
"""
from alembic import op
import sqlalchemy as sa


revision = "20261026e002"
down_revision = "20261026e001"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "producers",
        "address",
        existing_type=sa.String(length=255),
        nullable=True,
    )


def downgrade():
    # There is no address to restore; use an empty string so the NOT NULL
    # constraint can be re-applied.
    op.execute("UPDATE producers SET address = '' WHERE address IS NULL")
    op.alter_column(
        "producers",
        "address",
        existing_type=sa.String(length=255),
        nullable=False,
    )
