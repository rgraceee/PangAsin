"""replace production_records.notes with production_method enum

Revision ID: 0003_production_method_enum
Revises: 0002_encoder_barangay_schema
Create Date: 2026-09-03

Replace the free-text ``notes`` column with a structured ``production_method``
enum so encoder submissions are filterable, validated, and analytics-friendly.

- Drop ``production_records.notes`` (Text, nullable).
- Add ``production_records.production_method`` ENUM('solar','cooked','hybrid')
  NOT NULL with default 'solar' for the backfill of existing rows.

NOTE: The original free-text values (incl. demo seed content) are dropped.
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_production_method_enum"
down_revision = "0002_encoder_barangay_schema"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "production_records",
        sa.Column(
            "production_method",
            sa.Enum("solar", "cooked", "hybrid", name="production_method_enum"),
            nullable=False,
            server_default="solar",
        ),
    )
    op.alter_column("production_records", "production_method", server_default=None)
    op.drop_column("production_records", "notes")


def downgrade():
    op.add_column(
        "production_records",
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.drop_column("production_records", "production_method")
    op.execute("DROP TYPE IF EXISTS production_method_enum")
