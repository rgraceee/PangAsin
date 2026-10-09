"""add production/producers types and barangay scope

Revision ID: e3d4c5b6a7d8
Revises: d9e0f1a2b3c4
Create Date: 2026-09-18

Adds the ``production`` and ``producers`` values to ``report_type_enum`` and a
nullable ``barangay_id`` column to ``reports`` so reports can be scoped to a
single barangay. Existing rows remain untouched; the enum is extended.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e3d4c5b6a7d8'
down_revision = 'd9e0f1a2b3c4'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE report_type_enum ADD VALUE 'production'")
    op.execute("ALTER TYPE report_type_enum ADD VALUE 'producers'")
    op.add_column('reports', sa.Column('barangay_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_reports_barangay_id_barangays',
        'reports',
        'barangays',
        ['barangay_id'],
        ['id'],
        ondelete='RESTRICT',
    )


def downgrade():
    op.drop_constraint('fk_reports_barangay_id_barangays', 'reports', type_='foreignkey')
    op.drop_column('reports', 'barangay_id')
    # Removing enum values is not safe while rows may reference them. Leave
    # the new values in place.
    pass