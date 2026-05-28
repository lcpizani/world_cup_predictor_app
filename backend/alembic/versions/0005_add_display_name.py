"""add display_name to users

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa

revision = '0005_add_display_name'
down_revision = '0004_centralize_predictions'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('display_name', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('users', 'display_name')
