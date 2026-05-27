"""Add group column to matches

Revision ID: 0003_add_match_group
Revises: 0002_add_is_admin
Create Date: 2026-05-26 00:03:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_add_match_group"
down_revision = "0002_add_is_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "matches",
        sa.Column("group", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("matches", "group")
