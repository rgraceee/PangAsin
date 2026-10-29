"""add municipality management: case-insensitive uniqueness + forced password change

Revision ID: 20261028e001
Revises: 20261027e002

Adds the schema pieces needed by the admin "Add Municipality" feature:

- ``users.must_change_password`` (auto-created encoder accounts must replace
  the one-time temporary password on first login).
- Case-insensitive unique indexes on ``municipalities.name`` and
  ``users.email``.
- Replaces the exact-match ``uq_barangays_municipality_name`` constraint with
  a case-insensitive unique index on ``(municipality_id, lower(name))``.

Existing emails are lowercased so the new index can be created. Duplicate
detection runs before any write and aborts with a readable error listing the
offending rows, so operators can resolve conflicts manually.

Run with ``flask db upgrade`` on the live database (revision 20261027e002).
"""

from alembic import op
import sqlalchemy as sa


revision = "20261028e001"
down_revision = "20261027e002"
branch_labels = None
depends_on = None


def _assert_no_duplicates(bind, query, label):
    rows = bind.execute(sa.text(query)).fetchall()
    if rows:
        raise RuntimeError(
            f"Cannot add case-insensitive unique index on {label}: "
            f"duplicate rows exist: {rows}"
        )


def upgrade():
    bind = op.get_bind()

    # 1. Preflight: abort before changing anything if existing data conflicts.
    _assert_no_duplicates(
        bind,
        "SELECT lower(name) AS duplicate, array_agg(id) AS ids "
        "FROM municipalities GROUP BY lower(name) HAVING count(*) > 1",
        "municipalities.name",
    )
    _assert_no_duplicates(
        bind,
        "SELECT lower(email) AS duplicate, array_agg(id) AS ids "
        "FROM users GROUP BY lower(email) HAVING count(*) > 1",
        "users.email",
    )
    _assert_no_duplicates(
        bind,
        "SELECT municipality_id, lower(name) AS duplicate, array_agg(id) AS ids "
        "FROM barangays GROUP BY municipality_id, lower(name) HAVING count(*) > 1",
        "barangays (municipality_id, name)",
    )

    # 2. Normalize existing emails so the functional unique index is stable.
    op.execute(sa.text("UPDATE users SET email = lower(email) WHERE email <> lower(email)"))

    # 3. Forced first-login password change flag.
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )

    # 4. Replace the exact-match barangay constraint with a case-insensitive index.
    constraint_exists = bind.execute(
        sa.text(
            "SELECT 1 FROM pg_constraint "
            "WHERE conname = 'uq_barangays_municipality_name'"
        )
    ).scalar()
    if constraint_exists:
        op.drop_constraint(
            "uq_barangays_municipality_name", "barangays", type_="unique"
        )

    op.execute(
        "CREATE UNIQUE INDEX uq_barangays_municipality_name_lower "
        "ON barangays (municipality_id, lower(name))"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_municipalities_name_lower "
        "ON municipalities (lower(name))"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email))"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_users_email_lower")
    op.execute("DROP INDEX IF EXISTS uq_municipalities_name_lower")
    op.execute("DROP INDEX IF EXISTS uq_barangays_municipality_name_lower")

    # The exact-match constraint cannot be recreated if two barangays in the
    # same municipality now differ only by case; that is surfaced as an error
    # instead of silently dropping data.
    bind = op.get_bind()
    _assert_no_duplicates(
        bind,
        "SELECT municipality_id, name, array_agg(id) AS ids "
        "FROM barangays GROUP BY municipality_id, name HAVING count(*) > 1",
        "barangays (municipality_id, name) exact match",
    )
    op.create_unique_constraint(
        "uq_barangays_municipality_name",
        "barangays",
        ["municipality_id", "name"],
    )

    op.drop_column("users", "must_change_password")
