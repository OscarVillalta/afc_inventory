"""create_child_products_table

Revision ID: 4250ae6a0100
Revises: add_position_items
Create Date: 2026-02-05 19:01:51.630884

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4250ae6a0100'
down_revision = 'add_position_items'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create child_products table
    op.create_table(
        'child_products',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('reference_id', sa.Integer(), nullable=False),
        sa.Column('parent_product_id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['category_id'], ['product_categories.id']),
        sa.ForeignKeyConstraint(['parent_product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add child_product_id to transactions table
    op.add_column('transactions', sa.Column('child_product_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_transactions_child_product_id',
        'transactions', 'child_products',
        ['child_product_id'], ['id'],
        ondelete='RESTRICT'
    )
    
    # Add child_product_id to order_items table
    op.add_column('order_items', sa.Column('child_product_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_order_items_child_product_id',
        'order_items', 'child_products',
        ['child_product_id'], ['id']
    )
    
    # Make product_id nullable in transactions (was NOT NULL before)
    op.alter_column('transactions', 'product_id', nullable=True)
    
    # Create indexes
    op.create_index('ix_transactions_child_product_id', 'transactions', ['child_product_id'])


def downgrade() -> None:
    # Remove indexes
    op.drop_index('ix_transactions_child_product_id', table_name='transactions')
    
    # Make product_id NOT NULL again in transactions
    op.alter_column('transactions', 'product_id', nullable=False)
    
    # Remove child_product_id from order_items
    op.drop_constraint('fk_order_items_child_product_id', 'order_items', type_='foreignkey')
    op.drop_column('order_items', 'child_product_id')
    
    # Remove child_product_id from transactions
    op.drop_constraint('fk_transactions_child_product_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'child_product_id')
    
    # Drop child_products table
    op.drop_table('child_products')
