"""Add position field to order items

Revision ID: add_position_items
Revises: add_separator_items
Create Date: 2026-01-28 21:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_position_items'
down_revision = 'add_separator_items'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add position column with default 0
    op.add_column('order_items', sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
    
    # Update existing records to have sequential positions based on their ID
    # This ensures existing items maintain their current order
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE order_items 
        SET position = (
            SELECT COUNT(*) 
            FROM order_items AS oi2 
            WHERE oi2.order_id = order_items.order_id 
            AND oi2.id <= order_items.id
        ) - 1
    """))


def downgrade() -> None:
    # Drop position column
    op.drop_column('order_items', 'position')
