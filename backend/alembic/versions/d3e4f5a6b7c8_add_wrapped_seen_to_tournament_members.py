"""add_wrapped_seen_to_tournament_members

Revision ID: d3e4f5a6b7c8
Revises: c1d2e3f4a5b6
Create Date: 2026-07-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = 'd3e4f5a6b7c8'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tournament_members', sa.Column('wrapped_seen', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('tournament_members', 'wrapped_seen')
