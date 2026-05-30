"""add_group_standings
Revision ID: 37cd24dbd935
Revises: 9e4540cc8234
Create Date: 2026-05-30 01:15:29.455690
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '37cd24dbd935'
down_revision = '9e4540cc8234'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'group_standings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('group', sa.String(50), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('team_name', sa.String(100), nullable=False),
        sa.Column('played', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('won', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('drawn', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('lost', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('goals_for', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('goals_against', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('goal_difference', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('points', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('group', 'position', name='uq_group_standings_group_position'),
    )


def downgrade() -> None:
    op.drop_table('group_standings')
