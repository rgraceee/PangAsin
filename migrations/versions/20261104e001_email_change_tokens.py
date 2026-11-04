"""Store hashed one-time email-change verification tokens.

Revision ID: 20261104e001
Revises: 692b8eaa92a9
Create Date: 2026-11-04
"""

from alembic import op
import sqlalchemy as sa


revision = "20261104e001"
down_revision = "692b8eaa92a9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "email_change_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("current_email", sa.String(length=150), nullable=False),
        sa.Column("new_email", sa.String(length=150), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_email_change_tokens_user_id",
        "email_change_tokens",
        ["user_id"],
    )
    op.create_index(
        "ix_email_change_tokens_token_hash",
        "email_change_tokens",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_email_change_tokens_expires_at",
        "email_change_tokens",
        ["expires_at"],
    )
    op.create_index(
        "ix_email_change_tokens_created_at",
        "email_change_tokens",
        ["created_at"],
    )


def downgrade():
    op.drop_index(
        "ix_email_change_tokens_created_at",
        table_name="email_change_tokens",
    )
    op.drop_index(
        "ix_email_change_tokens_expires_at",
        table_name="email_change_tokens",
    )
    op.drop_index(
        "ix_email_change_tokens_token_hash",
        table_name="email_change_tokens",
    )
    op.drop_index(
        "ix_email_change_tokens_user_id",
        table_name="email_change_tokens",
    )
    op.drop_table("email_change_tokens")
