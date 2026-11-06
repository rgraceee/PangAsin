"""Add editable report titles.

Revision ID: 20261106e003
Revises: 20261106e002
Create Date: 2026-11-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20261106e003"
down_revision = "20261106e002"
branch_labels = None
depends_on = None


def upgrade():
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("reports")}
    if "title" not in existing:
        op.add_column("reports", sa.Column("title", sa.String(length=100), nullable=True))


def downgrade():
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("reports")}
    if "title" in existing:
        op.drop_column("reports", "title")
