"""add forecast run metrics columns (mae, rmse, mape, r2, candidate_metrics)

Revision ID: 0b705fced0f8
Revises: 3f3e08842422
Create Date: 2026-09-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0b705fced0f8"
down_revision = "3f3e08842422"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("forecast_runs", sa.Column("mae", sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column("forecast_runs", sa.Column("rmse", sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column("forecast_runs", sa.Column("mape", sa.Numeric(precision=8, scale=2), nullable=True))
    op.add_column("forecast_runs", sa.Column("r2", sa.Numeric(precision=8, scale=4), nullable=True))
    op.add_column("forecast_runs", sa.Column("candidate_metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade():
    op.drop_column("forecast_runs", "candidate_metrics")
    op.drop_column("forecast_runs", "r2")
    op.drop_column("forecast_runs", "mape")
    op.drop_column("forecast_runs", "rmse")
    op.drop_column("forecast_runs", "mae")
