"""Set household share and calculate each scope's free-space remainder.

Revision ID: 20261104e004
Revises: 20261104e003
Create Date: 2026-11-04
"""

from alembic import op
import sqlalchemy as sa


revision = "20261104e004"
down_revision = "20261104e003"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    for scope in ("national", "provincial"):
        connection.execute(
            sa.text(
                """
                UPDATE sector_demand_settings
                SET percentage = 40, updated_at = CURRENT_TIMESTAMP
                WHERE geographic_scope = :scope
                  AND lower(sector_name) = 'household'
                """
            ),
            {"scope": scope},
        )
        connection.execute(
            sa.text(
                """
                INSERT INTO sector_demand_settings
                    (geographic_scope, sector_name, percentage)
                SELECT :scope, 'Household', 40
                WHERE NOT EXISTS (
                    SELECT 1 FROM sector_demand_settings
                    WHERE geographic_scope = :scope
                      AND lower(sector_name) = 'household'
                )
                """
            ),
            {"scope": scope},
        )
        connection.execute(
            sa.text(
                """
                INSERT INTO sector_demand_settings
                    (geographic_scope, sector_name, percentage)
                SELECT :scope, 'Others', 0
                WHERE NOT EXISTS (
                    SELECT 1 FROM sector_demand_settings
                    WHERE geographic_scope = :scope
                      AND lower(sector_name) = 'others'
                )
                """
            ),
            {"scope": scope},
        )
        connection.execute(
            sa.text(
                """
                UPDATE sector_demand_settings
                SET percentage = CASE
                    WHEN ROUND(100 - COALESCE((
                        SELECT SUM(percentage)
                        FROM sector_demand_settings AS configured
                        WHERE configured.geographic_scope = :scope
                          AND lower(configured.sector_name) <> 'others'
                    ), 0), 2) < 0 THEN 0
                    ELSE ROUND(100 - COALESCE((
                        SELECT SUM(percentage)
                        FROM sector_demand_settings AS configured
                        WHERE configured.geographic_scope = :scope
                          AND lower(configured.sector_name) <> 'others'
                    ), 0), 2)
                END,
                updated_at = CURRENT_TIMESTAMP
                WHERE geographic_scope = :scope
                  AND lower(sector_name) = 'others'
                """
            ),
            {"scope": scope},
        )


def downgrade():
    # Keep configured allocations; reverting them could discard admin edits.
    pass
