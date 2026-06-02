"""add_provisional_points_to_tournament_member
Revision ID: 59e9dc17905a
Revises: 0006_add_minute_to_matches
Create Date: 2026-06-02 14:39:41.462556
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '59e9dc17905a'
down_revision = '0006_add_minute_to_matches'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tournament_members',
        sa.Column('provisional_points', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('tournament_members', 'provisional_points')
