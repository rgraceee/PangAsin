"""merge report branches

Revision ID: 4f5a6b7c8d9e
Revises: e3d4c5b6a7d8, d1e2f3a4b5c6
Create Date: 2026-09-18

Merges the two diverged branches that both originated from
``c7d8e9f0a1b2``:

* ``d1e2f3a4b5c6`` (producer age buckets) records columns that already
  exist in the live schema, so it is recorded as applied via this merge
  rather than re-executed.
* ``e3d4c5b6a7d8`` (production/producers types + barangay scope) is the
  active branch.

This migration changes no schema; it only makes alembic linear again so a
plain ``flask db upgrade`` resolves to a single head.

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "4f5a6b7c8d9e"
down_revision = ("e3d4c5b6a7d8", "d1e2f3a4b5c6")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass