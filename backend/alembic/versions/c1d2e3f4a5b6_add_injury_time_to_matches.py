"""add_injury_time_to_matches

Revision ID: c1d2e3f4a5b6
Revises: 507e8f2ac3ac
Create Date: 2026-06-16 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'c1d2e3f4a5b6'
down_revision = '507e8f2ac3ac'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('matches', sa.Column('injury_time', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('matches', 'injury_time')
