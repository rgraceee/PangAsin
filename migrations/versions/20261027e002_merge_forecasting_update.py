"""merge forecasting-update data model into the main schema history

Revision ID: 20261027e002
Revises: 20261026e004, 20261027e001

This revision only joins the municipality production/estimate branch to the
main three-status/address branch. It changes no schema.

The live database already contains the municipality production tables and the
forecast_runs.data_source column, so this revision is intended to be recorded
with ``flask db stamp 20261027e002`` on that database instead of being
executed there. Fresh databases apply the full chain with ``flask db upgrade``.
"""

from alembic import op


revision = "20261027e002"
down_revision = ("20261026e004", "20261027e001")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
