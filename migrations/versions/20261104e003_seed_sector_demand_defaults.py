"""Seed sector categories for both demand scopes.

Revision ID: 20261104e003
Revises: 20261104e002
Create Date: 2026-11-04
"""

from alembic import op
import sqlalchemy as sa


revision = "20261104e003"
down_revision = "20261104e002"
branch_labels = None
depends_on = None


DEFAULT_SECTORS = (
    ("national", "Others", 0),
    ("provincial", "Household", 0),
    ("provincial", "Food Processing", 0),
    ("provincial", "Industry", 0),
    ("provincial", "Agriculture", 0),
    ("provincial", "Others", 0),
)


def upgrade():
    connection = op.get_bind()
    for scope, name, percentage in DEFAULT_SECTORS:
        connection.execute(
            sa.text(
                """
                INSERT INTO sector_demand_settings
                    (geographic_scope, sector_name, percentage)
                SELECT :scope, :name, :percentage
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM sector_demand_settings
                    WHERE geographic_scope = :scope
                      AND lower(sector_name) = lower(:name)
                )
                """
            ),
            {"scope": scope, "name": name, "percentage": percentage},
        )


def downgrade():
    # Keep these rows: administrators may have edited them after the seed.
    pass
