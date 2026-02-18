"""add ledger columns to transactions

Revision ID: add_ledger_columns
Revises: convert_separator_to_type
Create Date: 2026-02-18 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_ledger_columns'
down_revision = 'convert_separator_to_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add last_updated_at column (default now for existing rows)
    op.add_column('transactions', sa.Column(
        'last_updated_at', sa.DateTime(), nullable=False,
        server_default=sa.func.now()
    ))

    # Add ledger_sequence column (nullable for pending transactions)
    op.add_column('transactions', sa.Column(
        'ledger_sequence', sa.BigInteger(), nullable=True
    ))

    # Create the PostgreSQL sequence for ledger ordering
    op.execute("CREATE SEQUENCE IF NOT EXISTS txn_ledger_seq")

    # Backfill ledger_sequence for existing committed transactions
    op.execute("""
        UPDATE transactions
        SET ledger_sequence = nextval('txn_ledger_seq')
        WHERE state = 'committed' AND ledger_sequence IS NULL
    """)

    # Create index on ledger_sequence
    op.create_index('ix_transactions_ledger_sequence', 'transactions', ['ledger_sequence'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_transactions_ledger_sequence', table_name='transactions')
    op.drop_column('transactions', 'ledger_sequence')
    op.drop_column('transactions', 'last_updated_at')
    op.execute("DROP SEQUENCE IF EXISTS txn_ledger_seq")
