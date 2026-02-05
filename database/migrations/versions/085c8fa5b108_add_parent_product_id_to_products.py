"""add_parent_product_id_to_products

Revision ID: 085c8fa5b108
Revises: add_position_items
Create Date: 2026-02-05 18:37:13.079707

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '085c8fa5b108'
down_revision = 'add_position_items'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add parent_product_id column to products table
    op.add_column('products', sa.Column('parent_product_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_products_parent_product_id',
        'products', 'products',
        ['parent_product_id'], ['id']
    )


def downgrade() -> None:
    # Remove the foreign key and column
    op.drop_constraint('fk_products_parent_product_id', 'products', type_='foreignkey')
    op.drop_column('products', 'parent_product_id')
