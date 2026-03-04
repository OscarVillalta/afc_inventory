"""Add blocked_items table

Revision ID: add_blocked_items_table
Revises: add_order_tracker_tables
Create Date: 2026-03-04 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_blocked_items_table'
down_revision = '18d6e266d7db'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'blocked_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )


def downgrade() -> None:
    op.drop_table('blocked_items')
