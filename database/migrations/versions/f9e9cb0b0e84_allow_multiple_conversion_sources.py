"""allow multiple conversion source transactions

Revision ID: f9e9cb0b0e84
Revises: e6e00a9c9c64
Create Date: 2026-02-10 22:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f9e9cb0b0e84'
down_revision = 'e6e00a9c9c64'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'conversion_decreases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversion_id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['conversion_id'], ['conversions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('transaction_id')
    )
    op.create_index('ix_conversion_decreases_conversion_id', 'conversion_decreases', ['conversion_id'], unique=False)

    # drop the old single-source linkage column
    op.drop_column('conversions', 'decrease_txn_id')


def downgrade() -> None:
    op.drop_index('ix_conversion_decreases_conversion_id', table_name='conversion_decreases')
    op.drop_table('conversion_decreases')

    # reintroduce the single-source column (data will not be restored)
    op.add_column('conversions', sa.Column('decrease_txn_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'conversions', 'transactions', ['decrease_txn_id'], ['id'])
    op.create_unique_constraint('conversions_decrease_txn_id_key', 'conversions', ['decrease_txn_id'])
