"""recreate reports table

Revision ID: c7d8e9f0a1b2
Revises: b5c6d7e8f9a0
Create Date: 2026-09-03 15:00:00.000000

Recreates the `reports` table (dropped by 3f3e08842422) using the existing
report_type_enum, report_format_enum, and report_status_enum PostgreSQL types.

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c7d8e9f0a1b2'
down_revision = 'b5c6d7e8f9a0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('report_type', postgresql.ENUM('provincial', 'municipality', 'forecast', 'data_quality', 'supply_demand', 'gis', name='report_type_enum', create_type=False), nullable=False),
    sa.Column('requested_by', sa.Integer(), nullable=False),
    sa.Column('municipality_id', sa.Integer(), nullable=True),
    sa.Column('date_range_start', sa.Date(), nullable=True),
    sa.Column('date_range_end', sa.Date(), nullable=True),
    sa.Column('format', postgresql.ENUM('pdf', 'excel', name='report_format_enum', create_type=False), nullable=False),
    sa.Column('status', postgresql.ENUM('pending', 'generated', 'failed', name='report_status_enum', create_type=False), server_default=sa.text("'pending'"), nullable=False),
    sa.Column('file_url', sa.String(length=255), nullable=True),
    sa.Column('generated_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['municipality_id'], ['municipalities.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('reports')
