"""Add description to air_filters

Revision ID: add_description_to_air_filters
Revises: 666853b4f3a8
Create Date: 2026-02-27 16:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_description_to_air_filters'
down_revision = '666853b4f3a8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('air_filters', sa.Column('description', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('air_filters', 'description')
