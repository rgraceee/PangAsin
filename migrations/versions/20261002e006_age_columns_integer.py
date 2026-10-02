"""Use regular integer columns for producer ages.

Revision ID: 20261002e006
Revises: 20261002e005
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002e006"
down_revision = "20261002e005"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "producer_report_entries", "age",
        existing_type=sa.SmallInteger(), type_=sa.Integer(), existing_nullable=True,
    )
    op.alter_column(
        "producers", "age",
        existing_type=sa.SmallInteger(), type_=sa.Integer(), existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        "producers", "age",
        existing_type=sa.Integer(), type_=sa.SmallInteger(), existing_nullable=True,
    )
    op.alter_column(
        "producer_report_entries", "age",
        existing_type=sa.Integer(), type_=sa.SmallInteger(), existing_nullable=True,
    )