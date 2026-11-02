"""SuperAdmin Help Center FAQ items.

Revision ID: 20261102e002
Revises: 20261102e001
Create Date: 2026-11-02

WHAT: Creates the help_faqs table for full CRUD of Help Center FAQ items
(question, answer, category, sort order, active flag). SuperAdmin manages
these via dedicated endpoints; the public Help Center reads active items.
WHY: A dedicated table gives proper create/edit/delete/reorder/category CRUD
instead of storing FAQ text as a blob inside site_content.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261102e002"
down_revision = "20261102e001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "help_faqs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False, server_default="General"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_help_faqs_category", "help_faqs", ["category"])
    op.create_index("ix_help_faqs_active", "help_faqs", ["active"])


def downgrade():
    op.drop_index("ix_help_faqs_active", table_name="help_faqs")
    op.drop_index("ix_help_faqs_category", table_name="help_faqs")
    op.drop_table("help_faqs")
