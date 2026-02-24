"""add stock_items tables

Revision ID: a1b2c3d4e5f6
Revises: f9e9cb0b0e84
Create Date: 2026-02-24 21:15:25.623000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f9e9cb0b0e84'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'stock_item_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    op.create_table(
        'stock_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id']),
        sa.ForeignKeyConstraint(['category_id'], ['stock_item_categories.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Insert product_category for stock_items (id=3)
    op.execute(
        "INSERT INTO product_categories (id, name) VALUES (3, 'stock_items') "
        "ON CONFLICT (id) DO NOTHING"
    )


def downgrade() -> None:
    op.drop_table('stock_items')
    op.drop_table('stock_item_categories')

    op.execute("DELETE FROM product_categories WHERE name = 'stock_items'")
