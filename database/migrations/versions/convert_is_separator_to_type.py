"""Convert is_separator boolean to type string column

Revision ID: convert_separator_to_type
Revises: f9e9cb0b0e84
Create Date: 2026-02-12 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'convert_separator_to_type'
down_revision = 'f9e9cb0b0e84'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add the new type column with a default
    op.add_column('order_items', sa.Column('type', sa.String(), nullable=False, server_default='Product_Item'))

    # Migrate data: is_separator=True -> 'Unit_Separator', is_separator=False -> 'Product_Item'
    op.execute("UPDATE order_items SET type = 'Unit_Separator' WHERE is_separator = true")
    op.execute("UPDATE order_items SET type = 'Product_Item' WHERE is_separator = false")

    # Drop the old is_separator column
    op.drop_column('order_items', 'is_separator')


def downgrade() -> None:
    # Add back the is_separator column
    op.add_column('order_items', sa.Column('is_separator', sa.Boolean(), nullable=False, server_default='0'))

    # Migrate data back
    op.execute("UPDATE order_items SET is_separator = true WHERE type IN ('Unit_Separator', 'Section_Separator')")
    op.execute("UPDATE order_items SET is_separator = false WHERE type IN ('Product_Item', 'Sales_Item')")

    # Drop the type column
    op.drop_column('order_items', 'type')
