"""recreate demand_benchmarks table

Revision ID: a1b2c3d4e5f6
Revises: 0b705fced0f8
Create Date: 2026-09-03 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '0b705fced0f8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('demand_benchmarks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('year', sa.SmallInteger(), nullable=False),
    sa.Column('geographic_scope', postgresql.ENUM('national', 'provincial', name='geographic_scope_enum', create_type=False), nullable=False),
    sa.Column('demand_volume', sa.Numeric(precision=14, scale=2), nullable=False),
    sa.Column('local_production', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('import_volume', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('source_name', sa.String(length=255), nullable=False),
    sa.Column('source_reference', sa.Text(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('demand_volume IS NULL OR demand_volume >= 0', name='chk_demand_volume'),
    sa.CheckConstraint('local_production IS NULL OR local_production >= 0', name='chk_local_production'),
    sa.CheckConstraint('import_volume IS NULL OR import_volume >= 0', name='chk_import_volume'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('demand_benchmarks')
