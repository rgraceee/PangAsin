"""Add configurable sector demand allocations by geographic scope.

Revision ID: 20261104e002
Revises: 20261104e001
Create Date: 2026-11-04
"""

from alembic import op
import sqlalchemy as sa


revision = "20261104e002"
down_revision = "20261104e001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sector_demand_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("geographic_scope", sa.String(length=20), nullable=False),
        sa.Column("sector_name", sa.String(length=100), nullable=False),
        sa.Column("percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "geographic_scope IN ('national', 'provincial')",
            name="chk_sector_demand_scope",
        ),
        sa.CheckConstraint(
            "percentage >= 0 AND percentage <= 100",
            name="chk_sector_demand_percentage",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "geographic_scope",
            "sector_name",
            name="uq_sector_demand_scope_name",
        ),
    )
    op.bulk_insert(
        sa.table(
            "sector_demand_settings",
            sa.column("geographic_scope", sa.String()),
            sa.column("sector_name", sa.String()),
            sa.column("percentage", sa.Numeric(5, 2)),
        ),
        [
            {"geographic_scope": "national", "sector_name": "Household", "percentage": 46.81},
            {"geographic_scope": "national", "sector_name": "Food Processing", "percentage": 26.33},
            {"geographic_scope": "national", "sector_name": "Industry", "percentage": 17.55},
            {"geographic_scope": "national", "sector_name": "Agriculture", "percentage": 9.30},
        ],
    )


def downgrade():
    op.drop_table("sector_demand_settings")
