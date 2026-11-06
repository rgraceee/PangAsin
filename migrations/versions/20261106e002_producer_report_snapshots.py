"""Persist producer report filters and generated data snapshots.

Revision ID: 20261106e002
Revises: 20261106e001
Create Date: 2026-11-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20261106e002"
down_revision = "20261106e001"
branch_labels = None
depends_on = None


def upgrade():
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("reports")}
    if "filters" not in existing:
        op.add_column("reports", sa.Column("filters", sa.JSON(), nullable=True))
    if "data_snapshot" not in existing:
        op.add_column("reports", sa.Column("data_snapshot", sa.JSON(), nullable=True))


def downgrade():
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("reports")}
    if "data_snapshot" in existing:
        op.drop_column("reports", "data_snapshot")
    if "filters" in existing:
        op.drop_column("reports", "filters")
