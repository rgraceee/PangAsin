"""Shrink record/report status enums to Pending, Approved, Rejected.

Revision ID: 20261026e003
Revises: 20261026e002
Create Date: 2026-10-26

WHAT: Replaces the old five-value status enums (draft, pending, approved,
      rejected, returned) with the three statuses the system actually uses.
      Any legacy draft/returned rows are mapped to pending first.
WHY:  Draft and Returned were removed from every UI surface and API path.
      Postgres cannot drop enum values in place, so each type is recreated.
"""
from alembic import op


revision = "20261026e003"
down_revision = "20261026e002"
branch_labels = None
depends_on = None

STATUS_TABLES = (
    ("production_records", "record_status_enum", "pending"),
    ("environment_reports", "environment_report_status_enum", "pending"),
    ("producer_reports", "producer_report_status_enum", "pending"),
)

ALLOWED = ("pending", "approved", "rejected")
LEGACY = ("draft", "pending", "approved", "rejected", "returned")


def _replace_enum(table, enum_name, values, default):
    old_name = f"{enum_name}_old"
    literals = ", ".join(f"'{value}'" for value in values)
    op.execute(f"ALTER TABLE {table} ALTER COLUMN status DROP DEFAULT")
    op.execute(f"ALTER TYPE {enum_name} RENAME TO {old_name}")
    op.execute(f"CREATE TYPE {enum_name} AS ENUM ({literals})")
    op.execute(
        f"ALTER TABLE {table} ALTER COLUMN status TYPE {enum_name} "
        f"USING status::text::{enum_name}"
    )
    op.execute(f"ALTER TABLE {table} ALTER COLUMN status SET DEFAULT '{default}'")
    op.execute(f"DROP TYPE {old_name}")


def upgrade():
    for table, _enum_name, _default in STATUS_TABLES:
        op.execute(
            f"UPDATE {table} SET status = 'pending' "
            "WHERE status IN ('draft', 'returned')"
        )
    for table, enum_name, default in STATUS_TABLES:
        _replace_enum(table, enum_name, ALLOWED, default)


def downgrade():
    # The original values are restored for schema compatibility only. Rows that
    # were mapped to pending during upgrade cannot be distinguished afterwards.
    for table, enum_name, _default in STATUS_TABLES:
        default = "draft" if table == "production_records" else "pending"
        _replace_enum(table, enum_name, LEGACY, default)
