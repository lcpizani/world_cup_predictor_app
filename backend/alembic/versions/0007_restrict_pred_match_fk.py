"""restrict prediction->match FK (ON DELETE RESTRICT)

Defense-in-depth: deleting a match that still has predictions must fail loudly
instead of cascading the predictions away. Mirrors predictions.user_id, which is
already RESTRICT and is why users survived the 2026-06-02 reset incident.

Revision ID: 0007_restrict_pred_match_fk
Revises: 59e9dc17905a
Create Date: 2026-06-02
"""
from alembic import op


revision = '0007_restrict_pred_match_fk'
down_revision = '59e9dc17905a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint('predictions_match_id_fkey', 'predictions', type_='foreignkey')
    op.create_foreign_key(
        'predictions_match_id_fkey',
        'predictions', 'matches',
        ['match_id'], ['id'],
        ondelete='RESTRICT',
    )


def downgrade() -> None:
    op.drop_constraint('predictions_match_id_fkey', 'predictions', type_='foreignkey')
    op.create_foreign_key(
        'predictions_match_id_fkey',
        'predictions', 'matches',
        ['match_id'], ['id'],
        ondelete='CASCADE',
    )
