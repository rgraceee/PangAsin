"""Store exact producer ages on report entries.

Revision ID: 20261002e005
Revises: 20261002e004
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002e005"
down_revision = "20261002e004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("producer_report_entries", sa.Column("age", sa.SmallInteger(), nullable=True))
    op.alter_column("producer_report_entries", "age_bracket", existing_type=sa.String(length=16), nullable=True)


def downgrade():
    op.drop_column("producer_report_entries", "age")
    op.alter_column("producer_report_entries", "age_bracket", existing_type=sa.String(length=16), nullable=False)