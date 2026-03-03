"""Add order_type to orders and order tracker tables

Revision ID: add_order_tracker_tables
Revises: 8c76c242b57c
Create Date: 2026-03-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_order_tracker_tables'
down_revision = '8c76c242b57c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('order_type', sa.String(), nullable=True))

    op.create_table(
        'order_tracker',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('current_department', sa.String(), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id'),
    )

    op.create_table(
        'order_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('from_department', sa.String(), nullable=True),
        sa.Column('to_department', sa.String(), nullable=False),
        sa.Column('action_taken', sa.String(), nullable=False),
        sa.Column('performed_by', sa.String(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('order_history')
    op.drop_table('order_tracker')
    op.drop_column('orders', 'order_type')
