"""SuperAdmin content versioning.

Revision ID: 20261102e001
Revises: 20261101e004
Create Date: 2026-11-02

WHAT: Adds version and effective_date to site_content so Legal Documents
(Privacy Policy, Terms) auto-increment a version number on each save and
record the effective date. Public pages display version + effective date.
WHY: Legal documents need an auditable, incrementing version and effective
date so readers can tell which version is in force.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261102e001"
down_revision = "20261101e004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("site_content", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("site_content", sa.Column("effective_date", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("site_content", "effective_date")
    op.drop_column("site_content", "version")
