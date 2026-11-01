"""SuperAdmin content, settings, announcements and record soft-delete.

Revision ID: 20261101e004
Revises: 20261101e003
Create Date: 2026-11-01

WHAT: Adds the SuperAdmin governance tables and soft-delete support.
  - site_content: editable public/help content (privacy, terms, about, faq_*)
    keyed by a slug, stored as JSON, with updated_by and updated_at.
  - system_settings: typed, validated runtime settings with defaults equal to
    current behaviour (password length, lockout, forgot-payment validity, etc.).
  - announcements: slim dismissible banner shown on public/admin/encoder layouts.
  - production_records.deleted_at / deleted_by: soft-delete for records so the
    SuperAdmin can remove bad data without destroying history.
WHY: One schema migration creates all SuperAdmin-managed tables and columns at
once, keeping existing tables and columns untouched so current behavior and
defaults are identical until a SuperAdmin changes a setting or edits content.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261101e004"
down_revision = "20261101e003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "site_content",
        sa.Column("key", sa.String(length=100), primary_key=True, nullable=False),
        sa.Column("data", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(length=100), primary_key=True, nullable=False),
        sa.Column("value", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("type", sa.String(length=30), nullable=False, server_default="string"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("level", sa.String(length=20), nullable=False, server_default="info"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("starts_at", sa.DateTime(), nullable=True),
        sa.Column("ends_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_announcements_active", "announcements", ["active"]
    )

    op.add_column(
        "production_records",
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "production_records",
        sa.Column("deleted_by", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_production_records_deleted_at", "production_records", ["deleted_at"]
    )


def downgrade():
    op.drop_index("ix_production_records_deleted_at", table_name="production_records")
    op.drop_column("production_records", "deleted_by")
    op.drop_column("production_records", "deleted_at")
    op.drop_index("ix_announcements_active", table_name="announcements")
    op.drop_table("announcements")
    op.drop_table("system_settings")
    op.drop_table("site_content")
