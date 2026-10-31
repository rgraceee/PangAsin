"""Add superadmin role, login lockout, login_events and audit login events.

Revision ID: 20261031e001
Revises: 20261030e001
Create Date: 2026-10-31

WHAT: Adds ``superadmin`` to the ``user_role_enum``, and adds
``failed_login_count`` and ``locked_until`` columns to ``users`` so admin can
lock accounts after repeated failed logins. Creates ``login_events`` table so
every authentication attempt (success or failure) is recorded.

WHY: SuperAdmin is a new role above admin. Lockout protects against password
guessing. Login events give supervisors an auditable view of who accessed the
system and when. ``actor_id`` on login_events is deliberately not a foreign key
so history survives account deletion.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261031e001"
down_revision = "20261030e001"
branch_labels = None
depends_on = None

OLD_ROLES = ("admin", "encoder")
NEW_ROLES = ("admin", "encoder", "superadmin")


def _replace_user_role_enum():
    """Recreate the user_role_enum type adding ``superadmin``."""
    old_name = "user_role_enum_old"
    literals = ", ".join(f"'{value}'" for value in NEW_ROLES)
    op.execute(f"ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
    op.execute(f"ALTER TYPE user_role_enum RENAME TO {old_name}")
    op.execute(f"CREATE TYPE user_role_enum AS ENUM ({literals})")
    op.execute(
        f"ALTER TABLE users ALTER COLUMN role TYPE user_role_enum "
        f"USING role::text::user_role_enum"
    )
    op.execute(f"DROP TYPE {old_name}")


def upgrade():
    # Recreate the enum first so 'superadmin' becomes a valid value.
    _replace_user_role_enum()
    # Restore any superadmin rows to admin (none should exist yet).
    op.execute(
        "UPDATE users SET role = 'admin' WHERE role = 'superadmin'"
    )

    op.add_column(
        "users",
        sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("locked_until", sa.DateTime(), nullable=True))

    op.create_table(
        "login_events",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True, index=True),
        sa.Column("email", sa.String(length=150), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, index=True),
    )
    op.create_index("ix_login_events_created_at", "login_events", ["created_at"])


def downgrade():
    op.drop_index("ix_login_events_created_at", table_name="login_events")
    op.drop_table("login_events")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_count")

    # Recreate the enum without 'superadmin' first, then restore any rows.
    old_name = "user_role_enum_old"
    literals = ", ".join(f"'{value}'" for value in OLD_ROLES)
    op.execute(f"ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
    op.execute(f"ALTER TYPE user_role_enum RENAME TO {old_name}")
    op.execute(f"CREATE TYPE user_role_enum AS ENUM ({literals})")
    op.execute(
        f"ALTER TABLE users ALTER COLUMN role TYPE user_role_enum "
        f"USING role::text::user_role_enum"
    )
    op.execute(f"DROP TYPE {old_name}")
    op.execute(
        "UPDATE users SET role = 'admin' WHERE role = 'superadmin'"
    )
