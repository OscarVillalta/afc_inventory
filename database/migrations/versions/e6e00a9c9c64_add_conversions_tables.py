"""add conversions tables

Revision ID: e6e00a9c9c64
Revises: 4250ae6a0100
Create Date: 2026-02-10 17:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e6e00a9c9c64'
down_revision = '4250ae6a0100'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'conversion_batches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('note', sa.String(), nullable=True),
        sa.Column('external_ref', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'conversions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=True),
        sa.Column('decrease_txn_id', sa.Integer(), nullable=False),
        sa.Column('increase_txn_id', sa.Integer(), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('note', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['conversion_batches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['decrease_txn_id'], ['transactions.id']),
        sa.ForeignKeyConstraint(['increase_txn_id'], ['transactions.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('decrease_txn_id'),
        sa.UniqueConstraint('increase_txn_id')
    )

    op.create_index('ix_conversion_batches_order_id', 'conversion_batches', ['order_id'], unique=False)
    op.create_index('ix_conversion_batches_created_at', 'conversion_batches', ['created_at'], unique=False)
    op.create_index('ix_conversions_batch_id', 'conversions', ['batch_id'], unique=False)
    op.create_index('ix_conversions_state', 'conversions', ['state'], unique=False)
    op.create_index('ix_conversions_created_at', 'conversions', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_conversions_created_at', table_name='conversions')
    op.drop_index('ix_conversions_state', table_name='conversions')
    op.drop_index('ix_conversions_batch_id', table_name='conversions')
    op.drop_table('conversions')
    op.drop_index('ix_conversion_batches_created_at', table_name='conversion_batches')
    op.drop_index('ix_conversion_batches_order_id', table_name='conversion_batches')
    op.drop_table('conversion_batches')
