"""baseline: existing Supabase schema

Revision ID: 0001_baseline
Revises:
Create Date: 2026-09-01

This baseline represents the already-existing Supabase schema that the
live database was created with. No operations are performed; it exists
so that ``alembic stamp head`` can mark the database as up-to-date and
future migrations can build on it.
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass