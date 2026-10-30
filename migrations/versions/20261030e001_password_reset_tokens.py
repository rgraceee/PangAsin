"""add single-use password reset tokens and session versioning

Revision ID: 20261030e001
Revises: 20261029e001

WHAT: Adds ``password_reset_tokens`` for hashed, expiring reset links and
      ``users.session_version`` for invalidating existing signed-in sessions
      after a successful reset.
WHY: Plain reset tokens must never be stored, and account sessions must stop
     working immediately once the password changes.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261030e001"
down_revision = "20261029e001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_password_reset_tokens_user_id",
        "password_reset_tokens",
        ["user_id"],
    )
    op.create_index(
        "ix_password_reset_tokens_token_hash",
        "password_reset_tokens",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_password_reset_tokens_expires_at",
        "password_reset_tokens",
        ["expires_at"],
    )
    op.create_index(
        "ix_password_reset_tokens_created_at",
        "password_reset_tokens",
        ["created_at"],
    )

    op.add_column(
        "users",
        sa.Column(
            "session_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade():
    op.drop_column("users", "session_version")
    op.drop_index(
        "ix_password_reset_tokens_created_at",
        table_name="password_reset_tokens",
    )
    op.drop_index(
        "ix_password_reset_tokens_expires_at",
        table_name="password_reset_tokens",
    )
    op.drop_index(
        "ix_password_reset_tokens_token_hash",
        table_name="password_reset_tokens",
    )
    op.drop_index(
        "ix_password_reset_tokens_user_id",
        table_name="password_reset_tokens",
    )
    op.drop_table("password_reset_tokens")
