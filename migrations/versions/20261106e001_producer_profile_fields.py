"""Add profile fields from the producer registry CSV.

Revision ID: 20261106e001
Revises: 20261105e001
Create Date: 2026-11-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20261106e001"
down_revision = "20261105e001"
branch_labels = None
depends_on = None


PROFILE_COLUMNS = (
    ("first_name", sa.String(length=100)),
    ("last_name", sa.String(length=100)),
    ("salt_farm_owner", sa.String(length=255)),
    ("designation", sa.String(length=100)),
    ("business_classification", sa.String(length=100)),
    ("contact_number", sa.String(length=32)),
)


def _column_names(table_name):
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def _add_profile_columns(table_name):
    existing = _column_names(table_name)
    for name, column_type in PROFILE_COLUMNS:
        if name not in existing:
            op.add_column(table_name, sa.Column(name, column_type, nullable=True))


def _drop_profile_columns(table_name):
    existing = _column_names(table_name)
    for name, _column_type in reversed(PROFILE_COLUMNS):
        if name in existing:
            op.drop_column(table_name, name)
            existing.remove(name)


def upgrade():
    _add_profile_columns("producers")
    _add_profile_columns("producer_report_entries")

    producer_columns = {
        column["name"]: column for column in sa.inspect(op.get_bind()).get_columns("producers")
    }
    if not producer_columns["sex"]["nullable"]:
        with op.batch_alter_table("producers") as batch_op:
            batch_op.alter_column(
                "sex",
                existing_type=sa.String(length=20),
                nullable=True,
            )

    report_columns = {
        column["name"]: column
        for column in sa.inspect(op.get_bind()).get_columns("producer_report_entries")
    }
    if not report_columns["sex"]["nullable"]:
        with op.batch_alter_table("producer_report_entries") as batch_op:
            batch_op.alter_column(
                "sex",
                existing_type=sa.String(length=20),
                nullable=True,
            )


def downgrade():
    op.execute("UPDATE producers SET sex = 'Unknown' WHERE sex IS NULL")
    op.execute("UPDATE producer_report_entries SET sex = 'Unknown' WHERE sex IS NULL")

    producer_columns = {
        column["name"]: column for column in sa.inspect(op.get_bind()).get_columns("producers")
    }
    if producer_columns["sex"]["nullable"]:
        with op.batch_alter_table("producers") as batch_op:
            batch_op.alter_column(
                "sex",
                existing_type=sa.String(length=20),
                nullable=False,
            )

    report_columns = {
        column["name"]: column
        for column in sa.inspect(op.get_bind()).get_columns("producer_report_entries")
    }
    if report_columns["sex"]["nullable"]:
        with op.batch_alter_table("producer_report_entries") as batch_op:
            batch_op.alter_column(
                "sex",
                existing_type=sa.String(length=20),
                nullable=False,
            )

    _drop_profile_columns("producer_report_entries")
    _drop_profile_columns("producers")