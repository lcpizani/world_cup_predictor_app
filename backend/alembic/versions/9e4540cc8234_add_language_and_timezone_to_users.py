"""add language and timezone to users
Revision ID: 9e4540cc8234
Revises: 0005_add_display_name
Create Date: 2026-05-29 15:20:18.809952
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9e4540cc8234'
down_revision = '0005_add_display_name'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('language', sa.String(5), nullable=True))
    op.add_column('users', sa.Column('timezone', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'timezone')
    op.drop_column('users', 'language')
