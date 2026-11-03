"""Log password reset requests and email delivery status.

Revision ID: 20261102e003
Revises: 20261102e002
Create Date: 2026-11-02

WHAT: Adds ``password_reset_requests`` to record each reset request, whether
      the reset email was sent or failed, and when the token was used.
WHY: Admin needs an auditable trail of password-reset activity and email
     delivery status for the admin stats card.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261102e003"
down_revision = "20261102e002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "password_reset_requests",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
        sa.Column("email_status", sa.String(length=10), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_password_reset_requests_user_id",
        "password_reset_requests",
        ["user_id"],
    )
    op.create_index(
        "ix_password_reset_requests_requested_at",
        "password_reset_requests",
        ["requested_at"],
    )
    op.create_index(
        "ix_password_reset_requests_email_status",
        "password_reset_requests",
        ["email_status"],
    )


def downgrade():
    op.drop_index(
        "ix_password_reset_requests_email_status",
        table_name="password_reset_requests",
    )
    op.drop_index(
        "ix_password_reset_requests_requested_at",
        table_name="password_reset_requests",
    )
    op.drop_index(
        "ix_password_reset_requests_user_id",
        table_name="password_reset_requests",
    )
    op.drop_table("password_reset_requests")
