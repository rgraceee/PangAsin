"""merge the deployed schema history branches

Revision ID: 20261015e000
Revises: 20261009e001, 0003_production_method_enum
"""

from alembic import op


revision = "20261015e000"
down_revision = (
    "20261009e001",
    "0003_production_method_enum",
)
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
