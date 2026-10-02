"""Add Environment to generated report types.

Revision ID: 20261002e003
Revises: 20261002e002
Create Date: 2026-10-02
"""

from alembic import op


revision = "20261002e003"
down_revision = "20261002e002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE report_type_enum ADD VALUE IF NOT EXISTS 'environment'")


def downgrade():
    pass