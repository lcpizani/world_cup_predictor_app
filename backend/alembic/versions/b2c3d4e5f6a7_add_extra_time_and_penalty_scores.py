"""add_extra_time_and_penalty_scores

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-08 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('matches', sa.Column('home_score_penalties', sa.Integer(), nullable=True))
    op.add_column('matches', sa.Column('away_score_penalties', sa.Integer(), nullable=True))
    op.add_column('matches', sa.Column('duration', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('matches', 'duration')
    op.drop_column('matches', 'away_score_penalties')
    op.drop_column('matches', 'home_score_penalties')
