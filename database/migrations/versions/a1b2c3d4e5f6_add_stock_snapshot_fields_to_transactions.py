"""add stock snapshot fields to transactions

Revision ID: a1b2c3d4e5f6
Revises: f9e9cb0b0e84
Create Date: 2026-02-18 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f9e9cb0b0e84'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('transactions', sa.Column('on_hand_before', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('on_hand_after', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('reserved_before', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('reserved_after', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('ordered_before', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('ordered_after', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('transactions', 'ordered_after')
    op.drop_column('transactions', 'ordered_before')
    op.drop_column('transactions', 'reserved_after')
    op.drop_column('transactions', 'reserved_before')
    op.drop_column('transactions', 'on_hand_after')
    op.drop_column('transactions', 'on_hand_before')
