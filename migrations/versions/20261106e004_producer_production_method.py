"""Add per-farmer production method.

Revision ID: 20261106e004
Revises: 20261106e003
Create Date: 2026-11-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20261106e004"
down_revision = "20261106e003"
branch_labels = None
depends_on = None


def _add_if_missing(table_name):
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}
    if "production_method" not in columns:
        op.add_column(
            table_name,
            sa.Column("production_method", sa.String(length=20), nullable=True),
        )


def _drop_if_present(table_name):
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}
    if "production_method" in columns:
        op.drop_column(table_name, "production_method")


def upgrade():
    _add_if_missing("producers")
    _add_if_missing("producer_report_entries")


def downgrade():
    _drop_if_present("producer_report_entries")
    _drop_if_present("producers")
