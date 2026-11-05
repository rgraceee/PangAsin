"""Add avatar_url column to users table.

Revision ID: 20261105e001
Revises: 20261104e004
Create Date: 2026-11-05

WHAT: Adds nullable avatar_url VARCHAR(300) column to users so profile picture
      URLs can be stored after upload.
WHY: Settings > Account avatar upload needs a column to persist the generated
     avatar URL per user. Keeps existing columns untouched.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261105e001"
down_revision = "20261104e004"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("users")}
    if "avatar_url" not in existing:
        op.add_column(
            "users",
            sa.Column("avatar_url", sa.String(length=300), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("users")}
    if "avatar_url" in existing:
        op.drop_column("users", "avatar_url")
