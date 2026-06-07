"""add_double_points_from_stage_to_scoring_rules

Revision ID: a1b2c3d4e5f6
Revises: 0007_restrict_pred_match_fk
Create Date: 2026-06-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = '0007_restrict_pred_match_fk'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tournament_scoring_rules',
        sa.Column('double_points_from_stage', sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tournament_scoring_rules', 'double_points_from_stage')
