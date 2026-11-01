"""Add audit log columns for old_value, new_value, reason, user_agent.

Revision ID: 20261101e005
Revises: 20261101e004
Create Date: 2026-11-01

WHAT: Adds explicit old_value, new_value, reason and user_agent columns to
      audit_logs so before/after values and the rationale for each change are
      queryable instead of being buried in the details JSON blob.
WHY: SuperAdmin audit review needs to filter by reason and compare old vs new
     values without parsing JSON. Keeps existing columns untouched.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261101e005"
down_revision = "20261101e004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "audit_logs",
        sa.Column("old_value", sa.JSON(), nullable=True),
    )
    op.add_column(
        "audit_logs",
        sa.Column("new_value", sa.JSON(), nullable=True),
    )
    op.add_column(
        "audit_logs",
        sa.Column("reason", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "audit_logs",
        sa.Column("user_agent", sa.String(length=255), nullable=True),
    )


def downgrade():
    op.drop_column("audit_logs", "user_agent")
    op.drop_column("audit_logs", "reason")
    op.drop_column("audit_logs", "new_value")
    op.drop_column("audit_logs", "old_value")
