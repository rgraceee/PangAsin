"""Add the persistent producer master list.

Revision ID: 20261002e004
Revises: 20261002e003
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002e004"
down_revision = "20261002e003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "producers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("barangay_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("age", sa.SmallInteger(), nullable=True),
        sa.Column("age_bracket", sa.String(length=16), nullable=True),
        sa.Column("sex", sa.String(length=20), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["barangay_id"], ["barangays.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_producers_barangay_id", "producers", ["barangay_id"])
    op.create_index("ix_producers_name", "producers", ["name"])
    op.execute(sa.text(
        """
        INSERT INTO producers (barangay_id, name, age_bracket, sex, address, created_at, updated_at)
        SELECT entries.barangay_id, MAX(entries.name), MAX(entries.age_bracket),
               MAX(entries.sex), MAX(entries.address), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM producer_report_entries AS entries
        JOIN producer_reports AS reports ON reports.id = entries.report_id
        WHERE reports.status = 'approved'
        GROUP BY entries.barangay_id, lower(entries.name), lower(entries.address)
        """
    ))


def downgrade():
    op.drop_index("ix_producers_name", table_name="producers")
    op.drop_index("ix_producers_barangay_id", table_name="producers")
    op.drop_table("producers")