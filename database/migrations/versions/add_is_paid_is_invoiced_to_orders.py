"""Add is_paid and is_invoiced to orders

Revision ID: add_is_paid_is_invoiced_to_orders
Revises: add_order_tracker_tables
Create Date: 2026-03-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_is_paid_is_invoiced_to_orders'
down_revision = 'add_order_tracker_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('is_paid', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('orders', sa.Column('is_invoiced', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('orders', 'is_invoiced')
    op.drop_column('orders', 'is_paid')
