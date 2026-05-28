"""centralize predictions: drop tournament_id from predictions

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004_centralize_predictions'
down_revision = '0003_add_match_group'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('uq_prediction_user_match_tournament', 'predictions', type_='unique')
    op.drop_constraint('predictions_tournament_id_fkey', 'predictions', type_='foreignkey')
    op.drop_column('predictions', 'tournament_id')
    op.create_unique_constraint('uq_prediction_user_match', 'predictions', ['user_id', 'match_id'])


def downgrade():
    op.drop_constraint('uq_prediction_user_match', 'predictions', type_='unique')
    op.add_column('predictions', sa.Column(
        'tournament_id',
        postgresql.UUID(as_uuid=True),
        nullable=True,
    ))
    op.create_foreign_key(
        'predictions_tournament_id_fkey',
        'predictions', 'tournaments',
        ['tournament_id'], ['id'],
        ondelete='CASCADE',
    )
    op.create_unique_constraint(
        'uq_prediction_user_match_tournament',
        'predictions',
        ['user_id', 'match_id', 'tournament_id'],
    )
