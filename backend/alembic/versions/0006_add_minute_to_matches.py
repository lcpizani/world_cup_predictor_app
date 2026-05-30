"""add minute to matches

Revision ID: 0006_add_minute_to_matches
Revises: 9e4540cc8234
Create Date: 2026-05-30
"""

from alembic import op
import sqlalchemy as sa


revision = '0006_add_minute_to_matches'
down_revision = '37cd24dbd935'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('matches', sa.Column('minute', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('matches', 'minute')
