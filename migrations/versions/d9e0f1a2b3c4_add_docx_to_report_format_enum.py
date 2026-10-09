"""add docx to report_format_enum

Revision ID: d9e0f1a2b3c4
Revises: c7d8e9f0a1b2
Create Date: 2026-09-18

Adds the ``docx`` value to the existing ``report_format_enum`` PostgreSQL enum so
reports can be generated as Word documents alongside PDF. Existing rows with
``format='excel'`` remain valid; the enum is extended, not renamed.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd9e0f1a2b3c4'
down_revision = 'c7d8e9f0a1b2'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE report_format_enum ADD VALUE 'docx'")


def downgrade():
    # Removing an enum value is not safe while rows may reference it, and the
    # app no longer creates 'excel' reports. Leave the value in place.
    pass