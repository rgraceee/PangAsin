"""Ensure the superadmin value exists on user_role_enum.

Revision ID: 20261101e003
Revises: 20261031e001
Create Date: 2026-11-01

WHAT: Idempotently adds ``superadmin`` to ``user_role_enum``.

WHY: Some deployed databases were stamped at 20261031e001 before the enum
was actually widened, so accounts with role ``superadmin`` cannot be stored.
``ADD VALUE IF NOT EXISTS`` repairs those databases and is a no-op on fresh
installs that already have the value.
"""

from alembic import op


revision = "20261101e003"
down_revision = "20261031e001"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'superadmin'"
    )


def downgrade():
    # WHAT: PostgreSQL cannot drop a single enum value safely.
    # WHY: Leaving the value is harmless; the previous migration handles the
    #      rows when a full downgrade is requested.
    pass
